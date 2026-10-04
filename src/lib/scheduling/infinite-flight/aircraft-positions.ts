import { Op } from "sequelize";
import { IfLiveConnection, LiveAircraft } from "@/lib/scheduling/models";
import { getIf3DAirportsSnapshot, getIfFleet, getIfPositionSnapshot } from "./client";
import { getIfAuthorizationSnapshot } from "./connection";
import { IF_LIVE_CACHE_MS, IfLiveError, isIfUuid } from "./config";
import { estimateNearbyIfAirport } from "./position";
import { ifBudgetRemainingMs, withIfRequestBudget } from "./request-budget";
import type { IfPositionView } from "./types";

const MAX_AIRCRAFT = 6;
const POSITION_CONCURRENCY = 3;
const MAX_LOCAL_ID = 2_147_483_647;

export type IfAircraftPositionView = {
  id: number;
  position: IfPositionView | null;
  nearbyAirport: { icao: string; distanceNm: number } | null;
  error?: string;
  code?: string;
  retryAfterSeconds?: number;
};

function validAircraftIds(ids: number[]) {
  return Array.isArray(ids) && ids.length >= 1 && ids.length <= MAX_AIRCRAFT && new Set(ids).size === ids.length &&
    ids.every(id => Number.isSafeInteger(id) && id > 0 && id <= MAX_LOCAL_ID);
}

export function localAircraftIdsFromRequest(request: Request): number[] {
  const params = new URL(request.url).searchParams;
  const values = params.getAll("aircraftIds");
  const raw = values[0]?.split(",") ?? [];
  if (values.length !== 1 || [...params.keys()].some(key => key !== "aircraftIds") ||
      raw.some(id => !/^[1-9]\d*$/.test(id)) || !validAircraftIds(raw.map(Number))) {
    throw new IfLiveError("Select one to six distinct local aircraft", "validation", 400);
  }
  return raw.map(Number);
}

const errorMessages: Record<string, string> = {
  not_found: "Local aircraft not found.",
  binding: "This aircraft is not linked to an aircraft in the connected IF organization.",
  position_unavailable: "IF has no persisted position for this aircraft.",
  invalid_response: "IF returned an unsupported aircraft position. Refresh or review the aircraft in IF.",
  forbidden: "IF denied access to this aircraft's position.",
  reauth_required: "The IF connection needs authorization again.",
  access_suspended: "The shared IF account no longer has scheduling access.",
  not_connected: "Connect the shared IF account before loading positions.",
  configuration: "The IF connection configuration needs administrator attention.",
  rate_limited: "IF's request limit was reached. Try again shortly.",
  budget: "The position request took too long. Refresh to try again.",
  unavailable: "IF could not provide this aircraft's position. Try again shortly.",
  upstream: "IF could not provide this aircraft's position. Try again shortly.",
  upstream_rejected: "IF rejected this aircraft's position request.",
  redirect: "IF could not provide a supported position response.",
};

function failedPosition(id: number, error: unknown): IfAircraftPositionView {
  const known = error instanceof IfLiveError && Object.prototype.hasOwnProperty.call(errorMessages, error.code);
  const code = known ? error.code : "unavailable";
  const retryAfterSeconds = error instanceof IfLiveError && Number.isFinite(error.retryAfterSeconds) && error.retryAfterSeconds > 0
    ? Math.min(3600, Math.ceil(error.retryAfterSeconds)) : undefined;
  return { id, position: null, nearbyAirport: null, code, error: errorMessages[code], ...(retryAfterSeconds ? { retryAfterSeconds } : {}) };
}

type Binding = { id: number; aircraft_id: number; if_aircraft_id: string | null };
const bindingSignature = (aircraft: Binding) => JSON.stringify([aircraft.id, aircraft.aircraft_id, aircraft.if_aircraft_id]);
const attributes = ["id", "aircraft_id", "if_aircraft_id"];

/** Only temporary position views are returned; no coordinates or IF metadata are written. */
export function loadIfAircraftPositions(aircraftIds: number[]) {
  return withIfRequestBudget(20_000, async () => {
    if (!validAircraftIds(aircraftIds)) throw new IfLiveError("Select one to six distinct local aircraft", "validation", 400);
    const rows = await LiveAircraft.findAll({ where: { id: { [Op.in]: aircraftIds } }, attributes, raw: true });
    const originals = new Map(rows.map(row => [row.id, { ...row }]));
    const signatures = new Map(rows.map(row => [row.id, bindingSignature(row)]));
    if (!aircraftIds.some(id => isIfUuid(originals.get(id)?.if_aircraft_id))) {
      const loadedAt = Date.now();
      return { aircraft: aircraftIds.map(id => failedPosition(id, new IfLiveError("", originals.has(id) ? "binding" : "not_found", 409))),
        loadedAt: new Date(loadedAt).toISOString(), expiresAt: new Date(loadedAt + IF_LIVE_CACHE_MS).toISOString(), airportLookupError: undefined };
    }
    const authorization = await getIfAuthorizationSnapshot();
    if (!isIfUuid(authorization.organizationId)) throw new IfLiveError("Select a connected IF organization before loading positions", "binding", 409);
    const organizationId = authorization.organizationId.toLowerCase();
    // One credential-scoped, short-lived fleet read serves the entire batch.
    const fleet = await getIfFleet(authorization.token, organizationId);
    const results: IfAircraftPositionView[] = new Array(aircraftIds.length);
    const expires = new Map<number, number>();
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(POSITION_CONCURRENCY, aircraftIds.length) }, async () => {
      while (next < aircraftIds.length) {
        const index = next++;
        const id = aircraftIds[index];
        const aircraft = originals.get(id);
        if (!aircraft) { results[index] = failedPosition(id, new IfLiveError("", "not_found", 404)); continue; }
        const remoteId = aircraft.if_aircraft_id?.toLowerCase();
        const members = isIfUuid(remoteId) ? fleet.filter(row => row.id.toLowerCase() === remoteId) : [];
        if (members.length !== 1 || members[0].organizationId.toLowerCase() !== organizationId) {
          results[index] = failedPosition(id, new IfLiveError("", "binding", 409)); continue;
        }
        try {
          if (ifBudgetRemainingMs() < 750) throw new IfLiveError("", "budget", 503, 15);
          const snapshot = await getIfPositionSnapshot(authorization.token, remoteId!, { fresh: true });
          if (!Number.isFinite(snapshot.expiresAt)) throw new IfLiveError("", "invalid_response", 502);
          const position: IfPositionView = { state: snapshot.position.state, isOnGround: snapshot.position.isOnGround,
            latitude: snapshot.position.latitude, longitude: snapshot.position.longitude, updatedAt: snapshot.position.updatedAt };
          results[index] = { id, position, nearbyAirport: null };
          expires.set(id, snapshot.expiresAt);
        } catch (error) { results[index] = failedPosition(id, error); }
      }
    }));

    let airportLookupError: string | undefined;
    let airportExpiresAt: number | undefined;
    if (results.some(row => row.position?.isOnGround)) {
      try {
        if (ifBudgetRemainingMs() < 750) throw new IfLiveError("", "budget", 503, 15);
        const directory = await getIf3DAirportsSnapshot();
        if (!Number.isFinite(directory.expiresAt)) throw new IfLiveError("", "invalid_response", 502);
        airportExpiresAt = directory.expiresAt;
        for (const row of results) if (row.position) {
          const nearby = estimateNearbyIfAirport(row.position, directory.airports);
          row.nearbyAirport = nearby ? { icao: nearby.icao, distanceNm: nearby.distanceNm } : null;
        }
      } catch { airportLookupError = "The nearby airport reference is unavailable. IF position coordinates are still shown."; }
    }

    const [currentRows, connection] = await Promise.all([
      LiveAircraft.findAll({ where: { id: { [Op.in]: aircraftIds } }, attributes, raw: true }),
      IfLiveConnection.findByPk(1, { attributes: ["state", "access_token_encrypted", "connected_by", "organization_id"], raw: true }),
    ]);
    const current = new Map(currentRows.map(row => [row.id, row]));
    const changed = aircraftIds.some(id => {
      const old = signatures.get(id); const row = current.get(id);
      return old === undefined ? Boolean(row) : !row || bindingSignature(row) !== old;
    });
    if (changed || !connection || connection.state !== "connected" || connection.access_token_encrypted !== authorization.credential ||
        connection.connected_by !== authorization.owner || connection.organization_id?.toLowerCase() !== organizationId) {
      throw new IfLiveError("The aircraft links or IF connection changed while loading positions; refresh and try again", "connection_changed", 409);
    }
    const loadedAt = Date.now();
    for (let index = 0; index < results.length; index += 1) {
      const row = results[index];
      if (row.position && expires.get(row.id)! <= loadedAt) {
        results[index] = { ...failedPosition(row.id, new IfLiveError("", "unavailable", 503, 1)),
          error: "The temporary IF position expired. Refresh to load it again." };
        expires.delete(row.id);
      }
    }
    if (results.some(row => row.nearbyAirport) && airportExpiresAt! <= loadedAt) {
      for (const row of results) row.nearbyAirport = null;
      airportLookupError = "The temporary nearby airport reference expired. Refresh to load it again.";
    }
    const referenceExpiry = results.some(row => row.nearbyAirport) ? airportExpiresAt! : Number.POSITIVE_INFINITY;
    return { aircraft: results, loadedAt: new Date(loadedAt).toISOString(),
      expiresAt: new Date(Math.min(loadedAt + IF_LIVE_CACHE_MS, referenceExpiry, ...expires.values())).toISOString(),
      ...(airportLookupError ? { airportLookupError } : {}) };
  });
}
