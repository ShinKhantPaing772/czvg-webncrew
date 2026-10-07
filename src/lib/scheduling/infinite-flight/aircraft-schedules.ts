import { IfLiveConnection, LiveAircraft, LiveFlight } from "@/lib/scheduling/models";
import { getIfFleet, getIfSchedules } from "./client";
import { getIfAuthorizationSnapshot } from "./connection";
import { getIfLiveConfig, IF_LIVE_CACHE_MS, IfLiveError, isIfUuid } from "./config";
import { ifBudgetRemainingMs, withIfRequestBudget } from "./request-budget";
import { isIfScheduleVisibleToPilot, toIfAircraftScheduleView } from "./schedule-view";
export type { IfAircraftScheduleView } from "./schedule-view";

export function localAircraftIdFromRequest(request: Request): number {
  const params = new URL(request.url).searchParams;
  const values = params.getAll("aircraftId");
  if (values.length !== 1 || [...params.keys()].some(key => key !== "aircraftId") ||
      !/^[1-9]\d*$/.test(values[0]) || !Number.isSafeInteger(Number(values[0])) || Number(values[0]) > 2_147_483_647) {
    throw new IfLiveError("Select one valid local aircraft", "validation", 400);
  }
  return Number(values[0]);
}

/** Temporary IF responses only; the local fleet binding determines every upstream identifier. */
export function loadIfAircraftSchedules(aircraftId: number, options: { admin?: boolean } = {}) {
  return withIfRequestBudget(20_000, async () => {
    if (!Number.isSafeInteger(aircraftId) || aircraftId <= 0 || aircraftId > 2_147_483_647) {
      throw new IfLiveError("Select one valid local aircraft", "validation", 400);
    }
    const aircraft = await LiveAircraft.findByPk(aircraftId, { attributes: ["id", "aircraft_id", "if_aircraft_id"], raw: true });
    if (!aircraft) throw new IfLiveError("Local aircraft not found", "not_found", 404);
    if (!isIfUuid(aircraft.if_aircraft_id)) throw new IfLiveError("This local aircraft is not linked to Infinite Flight", "binding", 409);
    const remoteId = aircraft.if_aircraft_id.toLowerCase();
    const authorization = await getIfAuthorizationSnapshot();
    if (!isIfUuid(authorization.organizationId)) throw new IfLiveError("Select a connected IF organization before loading schedules", "binding", 409);
    const organizationId = authorization.organizationId.toLowerCase();
    const fleet = await getIfFleet(authorization.token, organizationId, { fresh: true });
    const matches = fleet.filter(row => row.id.toLowerCase() === remoteId);
    if (matches.length !== 1 || matches[0].organizationId.toLowerCase() !== organizationId) {
      throw new IfLiveError("The linked aircraft does not belong to the connected IF organization; review its link", "binding", 409);
    }
    const schedules = await getIfSchedules(authorization.token, remoteId, { fresh: true });
    if (schedules.some(row => !isIfUuid(row.aircraftId) || row.aircraftId.toLowerCase() !== remoteId ||
        !isIfUuid(row.organizationId) || row.organizationId.toLowerCase() !== organizationId)) {
      throw new IfLiveError("IF returned schedules for a different aircraft or organization", "invalid_response", 502);
    }
    const [currentAircraft, currentConnection] = await Promise.all([
      LiveAircraft.findByPk(aircraftId, { attributes: ["id", "aircraft_id", "if_aircraft_id"], raw: true }),
      IfLiveConnection.findByPk(1, { attributes: ["state", "access_token_encrypted", "connected_by", "organization_id"], raw: true }),
    ]);
    if (!currentAircraft || currentAircraft.aircraft_id !== aircraft.aircraft_id || currentAircraft.if_aircraft_id?.toLowerCase() !== remoteId ||
        !currentConnection || currentConnection.state !== "connected" || currentConnection.access_token_encrypted !== authorization.credential ||
        currentConnection.connected_by !== authorization.owner || currentConnection.organization_id?.toLowerCase() !== organizationId) {
      throw new IfLiveError("The aircraft link or IF connection changed while loading schedules; refresh and try again", "connection_changed", 409);
    }
    if (ifBudgetRemainingMs() <= 0) throw new IfLiveError("IF schedules took too long to load; try again", "budget", 503, 15);
    const loadedAt = Date.now();
    const config = getIfLiveConfig();
    const managedFlights = await LiveFlight.findAll({ where: { live_aircraft_id: aircraftId }, attributes: ["id", "public_id", "if_schedule_id", "status", "publishing_state"], raw: true });
    const visibleSchedules = options.admin === true ? schedules : schedules.filter(row => isIfScheduleVisibleToPilot(row, managedFlights));
    return {
      schedules: visibleSchedules.map(row => toIfAircraftScheduleView(row, managedFlights, options.admin === true && config.bindingReady)),
      loadedAt: new Date(loadedAt).toISOString(), expiresAt: new Date(loadedAt + IF_LIVE_CACHE_MS).toISOString(),
      publishingReady: config.publishingReady, publishingDisabledReasons: config.publishingDisabledReasons,
      matchingReady: options.admin === true && config.bindingReady,
    };
  });
}
