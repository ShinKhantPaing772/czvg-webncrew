import { Op, QueryTypes, type Transaction } from "sequelize";
import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { canAccessCrewCenter } from "@/lib/pilot-status";
import { canAccessLiveScheduling } from "@/lib/scheduling/access";
import { IfLiveConnection, IfLiveOutbox, LiveAircraft, LiveFlight, LiveFlightMember, LiveScheduleEvent } from "@/lib/scheduling/models";
import { getIfAuthorizationSnapshot } from "./connection";
import { IfLiveError, isIfUuid, requireIfLiveConfig } from "./config";
import { getIfSchedules, updateIfSchedule } from "./client";
import { validateIfAircraftBinding } from "./binding";
import { assertIfItinerary, crewIsSubset, sameIfCrew, sameIfSchedule, scheduleMarker, type IfLocalFlight } from "./itinerary";
import { buildIfPayload, type PublishedPayload } from "./sync";
import { ifScheduleFingerprint, meaningfulIfScheduleTime } from "./schedule-view";
import { ifBudgetRemainingMs, withIfRequestBudget } from "./request-budget";
import type { AuthoredIfPayload, IfCrew, IfSchedule } from "./types";

type MatchInput = { flightId: number; scheduleId: string; expectedFingerprint: string; expectedRevision: number };
type Authorization = Awaited<ReturnType<typeof getIfAuthorizationSnapshot>>;

function parseMatch(value: unknown): MatchInput {
  const body = value as Record<string, unknown>;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(key => !["flightId", "scheduleId", "expectedFingerprint", "expectedRevision"].includes(key)) ||
      !Number.isSafeInteger(body.flightId) || Number(body.flightId) <= 0 || Number(body.flightId) > 2_147_483_647 ||
      !Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) <= 0 || Number(body.expectedRevision) > 2_147_483_647 ||
      !isIfUuid(body.scheduleId) || typeof body.expectedFingerprint !== "string" || !/^[0-9a-f]{64}$/.test(body.expectedFingerprint)) {
    throw new IfLiveError("Select the approved local flight and the reviewed IF schedule version", "validation", 400);
  }
  return { flightId: Number(body.flightId), scheduleId: body.scheduleId.toLowerCase(), expectedFingerprint: body.expectedFingerprint, expectedRevision: Number(body.expectedRevision) };
}

function assertUnstarted(remote: IfSchedule) {
  if (remote.status !== 1 || meaningfulIfScheduleTime(remote.actualDepartureUtc) || meaningfulIfScheduleTime(remote.actualArrivalUtc)) {
    throw new IfLiveError("Only an unstarted scheduled IF flight can be matched; started, cancelled, and arrived flights are locked", "locked", 409);
  }
}

function assertSameFlight(remote: IfSchedule, desired: AuthoredIfPayload) {
  assertUnstarted(remote);
  if (remote.originIcao.toUpperCase() !== desired.schedule.originIcao || remote.destinationIcao.toUpperCase() !== desired.schedule.destinationIcao || remote.flightType !== desired.schedule.flightType) {
    throw new IfLiveError("The IF route and flight type must match the local flight before identifying them as the same flight", "conflict", 409);
  }
  if (remote.crew.length > 3 || remote.crew.filter(member => member.role === 0).length > 1 ||
      new Set(remote.crew.map(member => member.userId.toLowerCase())).size !== remote.crew.length || !crewIsSubset(remote.crew, desired.crew)) {
    throw new IfLiveError("The IF captain and existing crew must match the local approved crew; repair the assignments before matching", "crew", 409);
  }
}

/** Recheck local authority under the scheduling mutex; release row locks before HTTP. */
async function currentMatch(input: MatchInput, actorId: number, original: LiveFlight, aircraft: LiveAircraft, authorization: Authorization,
  catalogSignature: string, expectedPayload?: AuthoredIfPayload, work?: (flight: LiveFlight, transaction: Transaction) => Promise<void>) {
  return sequelize.transaction(async transaction => {
    const mutex = await sequelize.query<{ name: string }>("SELECT name FROM options WHERE name = 'live_scheduling_mutex' FOR UPDATE", { type: QueryTypes.SELECT, transaction });
    if (!mutex.length) throw new IfLiveError("The scheduling mutex migration has not been installed", "configuration");
    const flight = await LiveFlight.findByPk(input.flightId, { transaction });
    if (!flight || flight.status !== "approved" || flight.revision !== input.expectedRevision || flight.live_aircraft_id !== original.live_aircraft_id ||
        (flight.if_schedule_id && flight.if_schedule_id.toLowerCase() !== input.scheduleId)) {
      throw new IfLiveError("The local flight changed or is linked to a different IF schedule; refresh before matching", "conflict", 409);
    }
    const members = await LiveFlightMember.findAll({ where: { flight_id: flight.id, status: "approved" }, transaction });
    const crewIds = [...new Set([flight.captain_id, ...members.map(row => row.pilot_id)])];
    if (crewIds.length > 3 || members.some(row => row.pilot_id === flight.captain_id) || new Set(members.map(row => row.pilot_id)).size !== members.length) {
      throw new IfLiveError("Repair the local captain and crew assignments before matching", "crew", 409);
    }
    const crew: IfCrew[] = [];
    for (const pilotId of [...new Set([actorId, authorization.owner, ...crewIds])].sort((a, b) => a - b)) {
      const pilot = await models.Pilot.findByPk(pilotId, { attributes: ["status", "ifuserid"], transaction, lock: transaction.LOCK.UPDATE });
      if (!pilot || !canAccessCrewCenter(Number(pilot.status))) throw new IfLiveError("An administrator or assigned pilot is no longer active", "forbidden", 403);
      if (pilotId === actorId || pilotId === authorization.owner) {
        const permissions = await models.Permission.findAll({ where: { userid: pilotId, name: { [Op.in]: ["admin", "scheduling"] } }, attributes: ["name"], transaction });
        if (!permissions.length) throw new IfLiveError("Scheduling administrator access changed; refresh before matching", "forbidden", 403);
      }
      if (crewIds.includes(pilotId)) {
        if (!await canAccessLiveScheduling(pilotId, Number(pilot.status), transaction) || !isIfUuid(pilot.ifuserid)) {
          throw new IfLiveError("Every approved crew member needs the Live Pilot award, an active account, and a valid IF user ID", "crew", 409);
        }
        crew.push({ userId: pilot.ifuserid.toLowerCase(), role: pilotId === flight.captain_id ? 0 : 1 });
      }
    }
    const binding = await LiveAircraft.findByPk(aircraft.id, { transaction, lock: transaction.LOCK.UPDATE });
    const connection = await IfLiveConnection.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
    const catalog = binding ? await models.Aircraft.findByPk(binding.aircraft_id, { transaction }) : null;
    if (!binding || !binding.active || binding.aircraft_id !== aircraft.aircraft_id || binding.if_aircraft_id?.toLowerCase() !== aircraft.if_aircraft_id?.toLowerCase() ||
        !catalog || catalogSignature !== JSON.stringify([catalog.id, catalog.status, catalog.ifaircraftid, catalog.ifliveryid]) ||
        !connection || connection.state !== "connected" || connection.connected_by !== authorization.owner ||
        connection.organization_id?.toLowerCase() !== authorization.organizationId?.toLowerCase() || connection.access_token_encrypted !== authorization.credential) {
      throw new IfLiveError("The IF connection, aircraft link, or catalog changed; refresh before matching", "connection_changed", 409);
    }
    if (await LiveFlight.findOne({ where: { if_schedule_id: input.scheduleId, id: { [Op.ne]: flight.id } }, transaction })) {
      throw new IfLiveError("Another local flight already owns this IF schedule", "conflict", 409);
    }
    const flights = await LiveFlight.findAll({ where: { live_aircraft_id: aircraft.id }, transaction });
    if (flights.some(row => row.status === "in_progress")) throw new IfLiveError("Finish the aircraft's in-progress local flight before matching its IF itinerary", "conflict", 409);
    if (await IfLiveOutbox.findOne({ where: { flight_id: flight.id, state: "processing" }, transaction, lock: transaction.LOCK.UPDATE })) {
      throw new IfLiveError("This flight is already publishing; wait for the worker before matching", "conflict", 409);
    }
    const desired = buildIfPayload(flight, crew);
    if (expectedPayload && (!sameIfSchedule(desired.schedule, expectedPayload.schedule) || !sameIfCrew(desired.crew, expectedPayload.crew))) {
      throw new IfLiveError("The local flight or IF crew identities changed during matching; refresh before retrying", "conflict", 409);
    }
    await work?.(flight, transaction);
    return { flight, flights, desired };
  });
}

async function queueMatch(flight: LiveFlight, payload: PublishedPayload, input: MatchInput, actorId: number, transaction: Transaction, confirmed: boolean) {
  const state = confirmed ? "queued" : "reconciliation";
  const error = confirmed ? null : "IF flight matching is awaiting confirmation; refresh and reconcile this same schedule before retrying";
  await flight.update({ if_schedule_id: input.scheduleId, last_published_payload: payload, publishing_state: state, error }, { transaction });
  const existing = await IfLiveOutbox.findOne({ where: { flight_id: flight.id, revision: flight.revision }, transaction, lock: transaction.LOCK.UPDATE });
  const values = { state, action: "sync", attempts: 0, next_attempt_at: new Date(), lease_until: null, error };
  if (existing) await existing.update(values, { transaction });
  else await IfLiveOutbox.create({ flight_id: flight.id, revision: flight.revision, ...values }, { transaction });
  await IfLiveOutbox.update({ state: "done", lease_until: null }, { where: { flight_id: flight.id, revision: { [Op.lt]: flight.revision }, state: { [Op.in]: ["queued", "failed", "conflict", "reconciliation"] } }, transaction });
  await LiveScheduleEvent.create({ live_aircraft_id: flight.live_aircraft_id, flight_id: flight.id, actor_id: actorId,
    action: confirmed ? "if_schedule_matched" : "if_schedule_match_requested", details: { schedule_id: input.scheduleId, revision: flight.revision } }, { transaction });
}

/** Explicit adoption writes CC-authored fields; fetched IF response fields never enter persistence. */
export function matchIfAircraftSchedule(actorId: number, value: unknown) {
  const input = parseMatch(value);
  if (!Number.isSafeInteger(actorId) || actorId <= 0) throw new IfLiveError("Scheduling administrator required", "forbidden", 403);
  const config = requireIfLiveConfig();
  if (!config.bindingReady) throw new IfLiveError(config.bindingDisabledReasons.join("; "), "disabled", 409);
  return withIfRequestBudget(25_000, async () => {
    const original = await LiveFlight.findByPk(input.flightId);
    if (!original) throw new IfLiveError("Local flight not found", "not_found", 404);
    const aircraft = await LiveAircraft.findByPk(original.live_aircraft_id);
    if (!aircraft?.active || !isIfUuid(aircraft.if_aircraft_id)) throw new IfLiveError("Select an active aircraft linked to IF", "binding", 409);
    const remoteAircraftId = aircraft.if_aircraft_id.toLowerCase();
    const lockName = `wnc_if_aircraft_${aircraft.id}`;
    const lockTransaction = await sequelize.transaction(); let acquired = false;
    try {
      const lock = await sequelize.query<{ acquired: number }>("SELECT GET_LOCK(:lockName, 0) AS acquired", { replacements: { lockName }, type: QueryTypes.SELECT, transaction: lockTransaction });
      acquired = Number(lock[0]?.acquired) === 1;
      if (!acquired) throw new IfLiveError("This aircraft is publishing or being edited; refresh before matching", "conflict", 409);
      const authorization = await getIfAuthorizationSnapshot();
      if (!isIfUuid(authorization.organizationId)) throw new IfLiveError("Select a connected IF organization first", "binding", 409);
      const catalog = await models.Aircraft.findByPk(aircraft.aircraft_id);
      if (!catalog || catalog.status !== 1) throw new IfLiveError("Select an active aircraft catalog entry before matching", "binding", 409);
      const catalogSignature = JSON.stringify([catalog.id, catalog.status, catalog.ifaircraftid, catalog.ifliveryid]);
      const local = await currentMatch(input, actorId, original, aircraft, authorization, catalogSignature);
      await validateIfAircraftBinding({ token: authorization.token, organizationId: authorization.organizationId, ifAircraftId: remoteAircraftId, catalog });
      const schedules = await getIfSchedules(authorization.token, remoteAircraftId, { fresh: true });
      if (schedules.some(row => row.aircraftId.toLowerCase() !== remoteAircraftId || row.organizationId.toLowerCase() !== authorization.organizationId!.toLowerCase())) {
        throw new IfLiveError("IF returned schedules for another aircraft or organization", "invalid_response", 502);
      }
      const targets = schedules.filter(row => row.id.toLowerCase() === input.scheduleId);
      if (targets.length !== 1) throw new IfLiveError("This IF schedule is missing or duplicated; refresh before matching", "conflict", 409);
      const remote = targets[0];
      if (ifScheduleFingerprint(remote) !== input.expectedFingerprint) throw new IfLiveError("This IF schedule changed after it was loaded; refresh before matching", "conflict", 409);
      assertSameFlight(remote, local.desired);
      const marker = scheduleMarker(local.flight.public_id);
      const markers = (remote.briefing ?? "").match(/\[WNC schedule:[^\]]*\]/gi) ?? [];
      if (markers.length > 1 || markers.some(value => value.toLowerCase() !== marker.toLowerCase()) ||
          schedules.some(row => row !== remote && row.briefing?.toLowerCase().includes(marker.toLowerCase()))) {
        throw new IfLiveError("This IF schedule has another local owner or a duplicate local reference; resolve it before matching", "conflict", 409);
      }
      const revised = schedules.map(row => row === remote ? { ...remote, ...local.desired.schedule, scheduledDepartureUtc: local.desired.schedule.scheduledDepartureUtc, scheduledArrivalUtc: local.desired.schedule.scheduledArrivalUtc } : row);
      assertIfItinerary({ schedules: revised, localFlights: local.flights as unknown as IfLocalFlight[], target: { publicId: local.flight.public_id, desired: local.desired.schedule }, allowStartedReservations: true });
      if (ifBudgetRemainingMs() < 1000) throw new IfLiveError("The IF matching check took too long; refresh before retrying", "budget", 503, 15);
      const checkpoint: PublishedPayload = { ...local.desired, crewPending: true };
      // Reserve the known ID before PUT. A crash or uncertain response can only
      // reconcile this existing schedule and can never trigger a duplicate POST.
      await currentMatch(input, actorId, original, aircraft, authorization, catalogSignature, local.desired,
        (flight, transaction) => queueMatch(flight, checkpoint, input, actorId, transaction, false));
      let updated: IfSchedule;
      try { updated = await updateIfSchedule(authorization.token, remoteAircraftId, input.scheduleId, local.desired.schedule); }
      catch (error) {
        if (error instanceof IfLiveError && error.uncertainWrite) throw new IfLiveError("IF did not confirm this match. Refresh and reconcile the same IF schedule before retrying", "reconciliation", 409, 60, true);
        throw error;
      }
      if (updated.id.toLowerCase() !== input.scheduleId || updated.aircraftId.toLowerCase() !== remoteAircraftId ||
          updated.organizationId.toLowerCase() !== authorization.organizationId.toLowerCase() || updated.status !== 1 ||
          meaningfulIfScheduleTime(updated.actualDepartureUtc) || meaningfulIfScheduleTime(updated.actualArrivalUtc) ||
          !sameIfSchedule(updated, local.desired.schedule) || !sameIfCrew(updated.crew, remote.crew)) {
        throw new IfLiveError("IF did not confirm the matched schedule and unchanged crew. Refresh and reconcile before retrying", "reconciliation", 409, 60, true);
      }
      await currentMatch(input, actorId, original, aircraft, authorization, catalogSignature, local.desired,
        (flight, transaction) => queueMatch(flight, checkpoint, input, actorId, transaction, true));
      return { flightId: input.flightId };
    } finally {
      try { if (acquired) await sequelize.query("SELECT RELEASE_LOCK(:lockName)", { replacements: { lockName }, type: QueryTypes.SELECT, transaction: lockTransaction }); }
      finally { await lockTransaction.commit(); }
    }
  });
}
