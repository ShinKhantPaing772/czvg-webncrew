import { Op, QueryTypes, type Transaction } from "sequelize";
import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { canAccessCrewCenter } from "@/lib/pilot-status";
import { IfLiveConnection, LiveAircraft, LiveFlight, LiveScheduleEvent } from "@/lib/scheduling/models";
import { getIfFleet, getIfSchedules, updateIfSchedule } from "./client";
import { getIfAuthorizationSnapshot } from "./connection";
import { IfLiveError, isIfUuid, requireIfLiveConfig } from "./config";
import { assertIfItinerary, sameIfCrew, sameIfSchedule, type IfLocalFlight } from "./itinerary";
import { ifBudgetRemainingMs, withIfRequestBudget } from "./request-budget";
import { ifScheduleFingerprint, meaningfulIfScheduleTime, toIfAircraftScheduleView } from "./schedule-view";
import type { IfSchedule, IfScheduleRequest } from "./types";
import { isIfFlightType } from "../flight-types";

type EditChanges = Partial<Pick<IfScheduleRequest, "callsign" | "flightType" | "originIcao" | "destinationIcao" | "scheduledDepartureUtc" | "scheduledArrivalUtc">>;
type EditInput = { aircraftId: number; scheduleId: string; expectedFingerprint: string; changes: EditChanges };
const fields = new Set(["callsign", "flightType", "originIcao", "destinationIcao", "scheduledDepartureUtc", "scheduledArrivalUtc"]);

function parseEdit(value: unknown): EditInput {
  const body = value as Record<string, unknown>;
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !["aircraftId", "scheduleId", "expectedFingerprint", "changes"].includes(key)) ||
      !Number.isSafeInteger(body.aircraftId) || Number(body.aircraftId) <= 0 || Number(body.aircraftId) > 2_147_483_647 ||
      !isIfUuid(body.scheduleId) || typeof body.expectedFingerprint !== "string" || !/^[0-9a-f]{64}$/.test(body.expectedFingerprint) ||
      !body.changes || typeof body.changes !== "object" || Array.isArray(body.changes)) {
    throw new IfLiveError("Select a local aircraft and the IF schedule version to edit", "validation", 400);
  }
  const changes: EditChanges = {};
  const entries = Object.entries(body.changes);
  if (!entries.length || entries.some(([key]) => !fields.has(key))) throw new IfLiveError("Edit only the IF callsign, flight type, route, or planned UTC times", "validation", 400);
  for (const [key, source] of entries) {
    if (key === "flightType") {
      if (!isIfFlightType(source)) throw new IfLiveError("Select a valid IF flight type", "validation", 400);
      changes.flightType = source;
      continue;
    }
    if ((key === "scheduledDepartureUtc" || key === "scheduledArrivalUtc") && source === null) { changes[key] = null; continue; }
    if (typeof source !== "string") throw new IfLiveError("Schedule text fields must contain text", "validation", 400);
    let value = source.trim();
    if (key === "callsign") {
      if (!value || value.length > 32 || /[\u0000-\u001f\u007f]/.test(source)) throw new IfLiveError("Callsign must contain 1 to 32 characters without control characters", "validation", 400);
    } else if (key === "originIcao" || key === "destinationIcao") {
      value = value.toUpperCase();
      if (!/^[A-Z0-9]{1,8}$/.test(value)) throw new IfLiveError("Airport codes must contain 1 to 8 alphanumeric characters", "validation", 400);
    } else {
      const meaningful = meaningfulIfScheduleTime(value);
      if (!meaningful) throw new IfLiveError("Enter a valid planned UTC time; the default year-one IF date means no time was set", "validation", 400);
      value = meaningful;
    }
    changes[key as Exclude<keyof EditChanges, "flightType">] = value;
  }
  if ((changes.scheduledDepartureUtc === null) !== (changes.scheduledArrivalUtc === null)) throw new IfLiveError("Clear both planned UTC times together", "validation", 400);
  return { aircraftId: Number(body.aircraftId), scheduleId: body.scheduleId.toLowerCase(), expectedFingerprint: body.expectedFingerprint, changes };
}

function editBody(remote: IfSchedule, changes: EditChanges): IfScheduleRequest {
  const body: IfScheduleRequest = {
    callsign: remote.callsign, flightType: remote.flightType, originIcao: remote.originIcao, destinationIcao: remote.destinationIcao,
    scheduledDepartureUtc: remote.scheduledDepartureUtc, scheduledArrivalUtc: remote.scheduledArrivalUtc,
    briefing: remote.briefing ?? null, flightPlan: remote.flightPlan ?? null, ...changes,
  };
  if (!isIfFlightType(body.flightType) ||
      typeof body.callsign !== "string" || !body.callsign || body.callsign.length > 32 || /[\u0000-\u001f\u007f]/.test(body.callsign) ||
      !/^[A-Z0-9]{1,8}$/i.test(body.originIcao) || !/^[A-Z0-9]{1,8}$/i.test(body.destinationIcao) ||
      (body.briefing !== null && (typeof body.briefing !== "string" || body.briefing.length > 4000)) ||
      (body.flightPlan !== null && (typeof body.flightPlan !== "string" || body.flightPlan.length > 16000))) {
    throw new IfLiveError("IF returned fields that cannot be safely preserved in an edit; review this flight in IF", "invalid_response", 502);
  }
  const departure = meaningfulIfScheduleTime(body.scheduledDepartureUtc);
  const arrival = meaningfulIfScheduleTime(body.scheduledArrivalUtc);
  if ((!departure) !== (!arrival) || (departure && arrival && Date.parse(arrival) <= Date.parse(departure))) {
    throw new IfLiveError("Set both planned UTC times with arrival after departure, or leave both unset", "validation", 400);
  }
  const result = { ...body, originIcao: body.originIcao.toUpperCase(), destinationIcao: body.destinationIcao.toUpperCase() };
  if (departure && arrival) { result.scheduledDepartureUtc = departure; result.scheduledArrivalUtc = arrival; }
  else { delete result.scheduledDepartureUtc; delete result.scheduledArrivalUtc; }
  return result;
}

type Authorization = Awaited<ReturnType<typeof getIfAuthorizationSnapshot>>;
async function assertCurrentEdit(actorId: number, original: LiveAircraft, authorization: Authorization, work?: (transaction: Transaction) => Promise<void>) {
  return sequelize.transaction(async transaction => {
    const mutex = await sequelize.query<{ name: string }>("SELECT name FROM options WHERE name = 'live_scheduling_mutex' FOR UPDATE", { transaction, type: QueryTypes.SELECT });
    if (!mutex.length) throw new IfLiveError("The scheduling mutex migration has not been installed", "configuration");
    // Match local mutations: pilot IDs, then aircraft, then the shared connection.
    for (const pilotId of [...new Set([actorId, authorization.owner])].sort((a, b) => a - b)) {
      const pilot = await models.Pilot.findByPk(pilotId, { attributes: ["status"], transaction, lock: transaction.LOCK.UPDATE });
      const permissions = await models.Permission.findAll({ where: { userid: pilotId, name: { [Op.in]: ["admin", "scheduling"] } }, attributes: ["name"], transaction });
      if (!pilot || !canAccessCrewCenter(Number(pilot.status)) || !permissions.length) throw new IfLiveError("Scheduling access changed during this edit; sign in with an active scheduling administrator", "forbidden", 403);
    }
    const current = await LiveAircraft.findByPk(original.id, { transaction, lock: transaction.LOCK.UPDATE });
    const connection = await IfLiveConnection.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
    if (!current || !current.active || current.aircraft_id !== original.aircraft_id || current.if_aircraft_id?.toLowerCase() !== original.if_aircraft_id?.toLowerCase() ||
        !connection || connection.state !== "connected" || connection.access_token_encrypted !== authorization.credential ||
        connection.connected_by !== authorization.owner || connection.organization_id?.toLowerCase() !== authorization.organizationId?.toLowerCase()) {
      throw new IfLiveError("The aircraft link or IF connection changed during this edit; refresh before retrying", "connection_changed", 409);
    }
    const flights = await LiveFlight.findAll({ where: { live_aircraft_id: original.id }, transaction });
    if (flights.some(flight => flight.status === "in_progress")) throw new IfLiveError("Finish the aircraft's in-progress local flight before editing its IF itinerary", "conflict", 409);
    await work?.(transaction);
    return flights;
  });
}

/** Admin-authored changes only. No fetched IF fields are saved or imported locally. */
export function editIfAircraftSchedule(actorId: number, value: unknown) {
  const input = parseEdit(value);
  if (!Number.isSafeInteger(actorId) || actorId <= 0) throw new IfLiveError("Scheduling administrator required", "forbidden", 403);
  const config = requireIfLiveConfig();
  if (!config.bindingReady) throw new IfLiveError(config.bindingDisabledReasons.join("; "), "disabled", 409);
  return withIfRequestBudget(25_000, async () => {
    const aircraft = await LiveAircraft.findByPk(input.aircraftId);
    if (!aircraft) throw new IfLiveError("Local aircraft not found", "not_found", 404);
    if (!aircraft.active || !isIfUuid(aircraft.if_aircraft_id)) throw new IfLiveError("Select an active local aircraft linked to IF", "binding", 409);
    const remoteAircraftId = aircraft.if_aircraft_id.toLowerCase();
    const lockName = `wnc_if_aircraft_${aircraft.id}`;
    // Pin the same advisory lock used by publishing to one connection. The
    // network requests hold no aircraft, pilot, connection, or mutex row lock.
    const lockTransaction = await sequelize.transaction(); let acquired = false;
    try {
      const lock = await sequelize.query<{ acquired: number }>("SELECT GET_LOCK(:lockName, 0) AS acquired", { replacements: { lockName }, type: QueryTypes.SELECT, transaction: lockTransaction });
      acquired = Number(lock[0]?.acquired) === 1;
      if (!acquired) throw new IfLiveError("This aircraft is publishing or being edited; wait and refresh before retrying", "conflict", 409);
      const authorization = await getIfAuthorizationSnapshot();
      if (!isIfUuid(authorization.organizationId)) throw new IfLiveError("Select a connected IF organization first", "binding", 409);
      const organizationId = authorization.organizationId.toLowerCase();
      const fleet = await getIfFleet(authorization.token, organizationId, { fresh: true });
      const matches = fleet.filter(row => row.id.toLowerCase() === remoteAircraftId && row.organizationId.toLowerCase() === organizationId);
      if (matches.length !== 1) throw new IfLiveError("The aircraft no longer belongs to the connected IF organization", "binding", 409);
      const schedules = await getIfSchedules(authorization.token, remoteAircraftId, { fresh: true });
      if (schedules.some(row => row.aircraftId.toLowerCase() !== remoteAircraftId || row.organizationId.toLowerCase() !== organizationId)) {
        throw new IfLiveError("IF returned schedules for another aircraft or organization", "invalid_response", 502);
      }
      const targets = schedules.filter(row => row.id.toLowerCase() === input.scheduleId);
      if (targets.length !== 1) throw new IfLiveError("This IF schedule is missing or duplicated; refresh before editing", "conflict", 409);
      const remote = targets[0];
      if (ifScheduleFingerprint(remote) !== input.expectedFingerprint) throw new IfLiveError("This IF schedule changed after it was loaded; refresh before editing", "conflict", 409);
      const localFlights = await assertCurrentEdit(actorId, aircraft, authorization);
      const view = toIfAircraftScheduleView(remote, localFlights, true);
      if (!view.editable) throw new IfLiveError(view.editDisabledReason!, view.managedFlightId || /\[WNC schedule:/i.test(remote.briefing ?? "") ? "managed_schedule" : "locked", 409);
      const body = editBody(remote, input.changes);
      const revised = schedules.map(row => row === remote ? { ...row, ...body, scheduledDepartureUtc: body.scheduledDepartureUtc, scheduledArrivalUtc: body.scheduledArrivalUtc } : row);
      assertIfItinerary({ schedules: revised, localFlights: localFlights as unknown as IfLocalFlight[], allowStartedReservations: true });
      if (ifBudgetRemainingMs() < 1000) throw new IfLiveError("The IF edit check took too long; refresh before retrying", "budget", 503, 15);
      // Validate again immediately before the single upstream PUT. The advisory
      // lock prevents local amendments, starts, and this app's publisher racing it.
      await assertCurrentEdit(actorId, aircraft, authorization);
      let updated: IfSchedule;
      try { updated = await updateIfSchedule(authorization.token, remoteAircraftId, remote.id, body); }
      catch (error) {
        if (error instanceof IfLiveError && error.uncertainWrite) throw new IfLiveError("IF did not confirm this edit. Refresh schedules and inspect the flight before retrying", "reconciliation", 409, 60, true);
        throw error;
      }
      if (updated.id.toLowerCase() !== input.scheduleId || updated.aircraftId.toLowerCase() !== remoteAircraftId || updated.organizationId.toLowerCase() !== organizationId ||
          !sameIfSchedule(updated, body) || !sameIfCrew(updated.crew, remote.crew)) {
        throw new IfLiveError("IF did not confirm the expected flight and crew after the edit. Refresh before retrying", "reconciliation", 409, 60, true);
      }
      await assertCurrentEdit(actorId, aircraft, authorization, async transaction => {
        await LiveScheduleEvent.create({ live_aircraft_id: aircraft.id, flight_id: null, actor_id: actorId, action: "if_schedule_edited",
          details: { schedule_id: input.scheduleId, changes: input.changes } }, { transaction });
      });
      return { schedule: toIfAircraftScheduleView(updated, localFlights, true) };
    } finally {
      try { if (acquired) await sequelize.query("SELECT RELEASE_LOCK(:lockName)", { replacements: { lockName }, type: QueryTypes.SELECT, transaction: lockTransaction }); }
      finally { await lockTransaction.commit(); }
    }
  });
}
