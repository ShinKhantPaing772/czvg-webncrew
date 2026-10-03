import { randomUUID } from "node:crypto";
import { Op, QueryTypes, Transaction, UniqueConstraintError } from "sequelize";
import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { canAccessLiveScheduling, livePilotAwardId } from "./access";
import { LiveAircraft, LiveFlight, LiveFlightMember, LiveScheduleEvent, IfLiveConnection, IfLiveOutbox } from "./models";
import { SchedulingError, airport, text, validId, scheduledWindow, projectedOrigin, orderedQueue, overlaps, validateQueue, RESERVED_STATUSES } from "./policy";

export type SchedulingActor = { id: number; admin: boolean };
type Body = Record<string, unknown>;
const reserved = { [Op.in]: [...RESERVED_STATUSES] };
const has = (body: Body, key: string) => Object.prototype.hasOwnProperty.call(body, key);

async function eligible(id: number, transaction: Transaction) {
  if (!(await canAccessLiveScheduling(id, undefined, transaction))) throw new SchedulingError("This pilot needs an active account and the live pilot award", 403);
}
async function event(aircraft: LiveAircraft, flight: LiveFlight | null, actor: SchedulingActor, action: string, details: Body, transaction: Transaction) {
  await LiveScheduleEvent.create({ live_aircraft_id: aircraft.id, flight_id: flight?.id ?? null, actor_id: actor.id, action, details }, { transaction });
}

async function bumpAndQueue(flight: LiveFlight, aircraft: LiveAircraft, transaction: Transaction) {
  flight.revision += 1;
  flight.error = null;
  if (aircraft.if_aircraft_id) {
    flight.publishing_state = process.env.IF_LIVE_AUTO_PUBLISH_ENABLED === "true" ? "queued" : "disabled";
    await flight.save({ transaction });
    await IfLiveOutbox.create({ flight_id: flight.id, revision: flight.revision, state: "queued", next_attempt_at: new Date() }, { transaction });
  } else {
    flight.publishing_state = "local";
    await flight.save({ transaction });
  }
}

async function pilotIdsForFlight(flightId: number, transaction: Transaction) {
  const flight = await LiveFlight.findByPk(flightId, { transaction });
  if (!flight) throw new SchedulingError("Flight not found", 404);
  const members = await LiveFlightMember.findAll({ where: { flight_id: flightId }, attributes: ["pilot_id"], transaction });
  return { flight, ids: [flight.captain_id, ...members.map(member => member.pilot_id)] };
}

// Short queue mutations are serialized before acquiring pilot and aircraft rows.
// This also avoids stale membership snapshots during cross-aircraft amendments.
async function mutate<T>(actor: SchedulingActor, body: Body, work: (transaction: Transaction, aircraft: LiveAircraft | null, flight: LiveFlight | null) => Promise<T>) {
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async transaction => {
    const mutex = await sequelize.query<{ name: string }>("SELECT name FROM options WHERE name = 'live_scheduling_mutex' FOR UPDATE", { type: QueryTypes.SELECT, transaction });
    if (!mutex.length) throw new SchedulingError("Live scheduling needs its SQL migration. Apply migrations/20261002_live_scheduling.sql first.", 503);
    let flight: LiveFlight | null = null;
    const ids = [actor.id];
    if (has(body, "captain_id")) ids.push(validId(body.captain_id, "Captain"));
    if (has(body, "flight_id")) {
      const found = await pilotIdsForFlight(validId(body.flight_id, "Flight"), transaction);
      flight = found.flight;
      ids.push(...found.ids);
    }
    for (const id of [...new Set(ids)].sort((a, b) => a - b)) {
      if (!(await models.Pilot.findByPk(id, { attributes: ["id"], transaction, lock: transaction.LOCK.UPDATE }))) throw new SchedulingError("Pilot not found", 404);
    }
    if (!actor.admin) await eligible(actor.id, transaction);
    const aircraftId = flight?.live_aircraft_id ?? (body.live_aircraft_id ? validId(body.live_aircraft_id, "Aircraft") : null);
    const aircraft = aircraftId ? await LiveAircraft.findByPk(aircraftId, { transaction, lock: transaction.LOCK.UPDATE }) : null;
    if (aircraftId && !aircraft) throw new SchedulingError("Live aircraft not found", 404);
    return work(transaction, aircraft, flight);
  });
}

async function queue(aircraftId: number, transaction: Transaction, exclude?: number) {
  return LiveFlight.findAll({ where: { live_aircraft_id: aircraftId, status: reserved, ...(exclude ? { id: { [Op.ne]: exclude } } : {}) }, order: [["scheduled_departure", "ASC"], ["id", "ASC"]], transaction });
}
function activeAircraft(aircraft: LiveAircraft) {
  if (!aircraft.active) throw new SchedulingError("This aircraft is inactive", 409);
}
function requireCaptain(actor: SchedulingActor, flight: LiveFlight) {
  if (!actor.admin && actor.id !== flight.captain_id) throw new SchedulingError("Only this flight's captain or a scheduling administrator can do this", 403);
}
function requireState(flight: LiveFlight, ...states: string[]) {
  if (!states.includes(flight.status)) throw new SchedulingError(`This action is unavailable for a ${flight.status.replaceAll("_", " ")} flight`, 409);
}
function flightState(flight: LiveFlight) {
  return { captain_id: flight.captain_id, callsign: flight.callsign, departure: flight.departure, arrival: flight.arrival,
    scheduled_departure: flight.scheduled_departure, scheduled_arrival: flight.scheduled_arrival, status: flight.status,
    actual_arrival: flight.actual_arrival, notes: flight.notes, revision: flight.revision };
}
function flightFields(body: Body, current?: LiveFlight) {
  return {
    ...scheduledWindow(body.scheduled_departure ?? current?.scheduled_departure.toISOString(), body.scheduled_arrival ?? current?.scheduled_arrival.toISOString()),
    callsign: has(body, "callsign") ? text(body.callsign, 32, "Callsign") : current?.callsign ?? null,
    arrival: airport(body.arrival ?? current?.arrival)!,
    notes: has(body, "notes") ? text(body.notes, 3000, "Notes") : current?.notes ?? null,
  };
}

async function checkPilotBookings(pilotIds: number[], flight: LiveFlight, transaction: Transaction, starting = false) {
  const otherFlights = await LiveFlight.findAll({ where: { status: reserved, id: { [Op.ne]: flight.id } }, transaction });
  const otherIds = otherFlights.map(other => other.id);
  const memberships = otherIds.length ? await LiveFlightMember.findAll({ where: { flight_id: { [Op.in]: otherIds }, status: "approved", pilot_id: { [Op.in]: pilotIds } }, transaction }) : [];
  for (const other of otherFlights) {
    if (!(pilotIds.includes(other.captain_id) || memberships.some(member => member.flight_id === other.id))) continue;
    if (overlaps(flight, other) || (starting && other.status === "in_progress")) throw new SchedulingError(`A crew member is already assigned to flight ${other.id} during this time`, 409);
  }
}
async function approvedCrew(flight: LiveFlight, transaction: Transaction) {
  return LiveFlightMember.findAll({ where: { flight_id: flight.id, status: "approved" }, transaction });
}
async function validateCrew(flight: LiveFlight, transaction: Transaction, starting = false) {
  const members = await approvedCrew(flight, transaction);
  if (members.length > 2) throw new SchedulingError("A flight allows one captain and two additional crew", 409);
  const ids = [flight.captain_id, ...members.map(member => member.pilot_id)];
  for (const id of ids) await eligible(id, transaction);
  await checkPilotBookings(ids, flight, transaction, starting);
}
async function validateApproval(aircraft: LiveAircraft, flight: LiveFlight, transaction: Transaction, amend = false) {
  activeAircraft(aircraft);
  const flights = await queue(aircraft.id, transaction, flight.id);
  // An amendment may invalidate successors, which are moved to needs_review.
  // A new proposal must fit the whole existing approved chain.
  const proposed = orderedQueue([...flights, flight]);
  validateQueue(aircraft.current_airport, amend ? proposed.slice(0, proposed.findIndex(item => item.id === flight.id) + 1) : proposed);
  await validateCrew(flight, transaction);
  if (!aircraft.current_airport) {
    const first = orderedQueue([...flights, flight])[0];
    await aircraft.update({ current_airport: first.departure, location_updated_by: flight.reviewed_by, location_updated_at: new Date() }, { transaction });
  }
}

async function repairQueue(aircraft: LiveAircraft, actor: SchedulingActor, transaction: Transaction) {
  const flights = await queue(aircraft.id, transaction);
  let origin = aircraft.current_airport;
  let previous: LiveFlight | null = null;
  for (const flight of flights) {
    if (flight.status === "in_progress") { origin = flight.arrival; previous = flight; continue; }
    if ((origin && flight.departure !== origin) || (previous && overlaps(previous, flight))) {
      await flight.update({ status: "needs_review", review_reason: `Aircraft queue changed. Confirm the route from ${origin ?? "its actual airport"} and the flight times.` }, { transaction });
      await bumpAndQueue(flight, aircraft, transaction);
      await event(aircraft, flight, actor, "chain_invalidated", { expected_origin: origin }, transaction);
      continue;
    }
    origin = flight.arrival;
    previous = flight;
  }
}

export async function requestFlight(actor: SchedulingActor, body: Body) {
  return mutate(actor, body, async (transaction, aircraft) => {
    if (!aircraft) throw new SchedulingError("Select a live aircraft");
    activeAircraft(aircraft);
    await eligible(actor.id, transaction);
    const fields = flightFields(body);
    const reservedFlights = await queue(aircraft.id, transaction);
    const departure = projectedOrigin(aircraft.current_airport, reservedFlights, fields.scheduled_departure) ?? airport(body.departure)!;
    if (departure === fields.arrival) throw new SchedulingError("Departure and destination must be different");
    const duplicate = await LiveFlight.findOne({ where: { captain_id: actor.id, live_aircraft_id: aircraft.id, status: "pending", departure, arrival: fields.arrival, scheduled_departure: fields.scheduled_departure, scheduled_arrival: fields.scheduled_arrival }, transaction });
    if (duplicate) throw new SchedulingError("This flight request already exists", 409);
    const flight = await LiveFlight.create({ ...fields, public_id: randomUUID(), live_aircraft_id: aircraft.id, captain_id: actor.id, departure, status: "pending" }, { transaction });
    await event(aircraft, flight, actor, "requested", fields, transaction);
    return { flight_id: flight.id };
  });
}

export async function changeFlight(actor: SchedulingActor, body: Body) {
  const action = String(body.action ?? "");
  return mutate(actor, body, async (transaction, aircraft, flight) => {
    if (!aircraft || !flight) throw new SchedulingError("Select a flight");
    const before = flightState(flight);
    const reason = text(body.reason, 500, "Reason");
    if (["approve", "reject", "amend", "reassign", "cancel"].includes(action) && !actor.admin) throw new SchedulingError("Scheduling administrator access required", 403);

    if (action === "edit") {
      requireCaptain(actor, flight); requireState(flight, "pending");
      const fields = flightFields(body, flight);
      const departure = projectedOrigin(aircraft.current_airport, await queue(aircraft.id, transaction), fields.scheduled_departure) ?? airport(body.departure ?? flight.departure)!;
      if (departure === fields.arrival) throw new SchedulingError("Departure and destination must be different");
      await flight.update({ ...fields, departure }, { transaction });
    } else if (action === "approve" || action === "amend" || action === "reassign") {
      requireState(flight, "pending", "needs_review", "approved");
      const wasApproved = flight.status === "approved";
      const fields = flightFields(body, flight);
      const captainId = has(body, "captain_id") ? validId(body.captain_id, "Captain") : flight.captain_id;
      const departure = airport(body.departure ?? flight.departure)!;
      if (departure === fields.arrival) throw new SchedulingError("Departure and destination must be different");
      await flight.update({ ...fields, departure, captain_id: captainId, reviewed_by: actor.id, reviewed_at: new Date(), review_reason: reason, status: "approved" }, { transaction });
      // Promoting a first officer must not consume another crew seat.
      await LiveFlightMember.update({ status: "withdrawn", reviewed_by: actor.id, reviewed_at: new Date() }, { where: { flight_id: flight.id, pilot_id: captainId }, transaction });
      await validateApproval(aircraft, flight, transaction, wasApproved);
      await bumpAndQueue(flight, aircraft, transaction);
      await repairQueue(aircraft, actor, transaction);
    } else if (action === "reject") {
      requireState(flight, "pending", "needs_review");
      if (!reason) throw new SchedulingError("A rejection reason is required");
      await flight.update({ status: "rejected", reviewed_by: actor.id, reviewed_at: new Date(), review_reason: reason }, { transaction });
      if (flight.if_schedule_id) await bumpAndQueue(flight, aircraft, transaction);
    } else if (action === "withdraw" || action === "cancel") {
      requireCaptain(actor, flight);
      requireState(flight, ...(action === "withdraw" ? ["pending"] : ["approved", "needs_review", "pending"]));
      await flight.update({ status: "cancelled", review_reason: reason }, { transaction });
      await bumpAndQueue(flight, aircraft, transaction);
      await repairQueue(aircraft, actor, transaction);
    } else if (action === "start") {
      requireCaptain(actor, flight); requireState(flight, "approved"); activeAircraft(aircraft);
      const flights = await queue(aircraft.id, transaction);
      if (flights[0]?.id !== flight.id || flights.some(other => other.status === "in_progress")) throw new SchedulingError("Finish the aircraft's preceding flight first", 409);
      if (aircraft.current_airport !== flight.departure) throw new SchedulingError("Aircraft location must be confirmed at the departure airport", 409);
      await validateCrew(flight, transaction, true);
      if (aircraft.if_aircraft_id && (flight.publishing_state !== "published" || flight.published_revision !== flight.revision)) throw new SchedulingError("Wait until this flight's latest schedule and crew are published to IF", 409);
      await flight.update({ status: "in_progress", actual_departure_at: new Date() }, { transaction });
    } else if (action === "complete") {
      requireCaptain(actor, flight); requireState(flight, "in_progress");
      const actual_arrival = airport(body.actual_arrival)!;
      await flight.update({ status: "completed", actual_arrival, actual_arrival_at: new Date() }, { transaction });
      await aircraft.update({ current_airport: actual_arrival, location_updated_by: actor.id, location_updated_at: new Date() }, { transaction });
      await repairQueue(aircraft, actor, transaction);
    } else if (["join", "withdraw_join", "approve_join", "reject_join"].includes(action)) {
      requireState(flight, ...(action === "withdraw_join" || action === "reject_join" ? ["approved", "needs_review"] : ["approved"]));
      if (action === "join") {
        await eligible(actor.id, transaction);
        if (flight.captain_id === actor.id) throw new SchedulingError("You are already the captain", 409);
        const existing = await LiveFlightMember.findOne({ where: { flight_id: flight.id, pilot_id: actor.id }, transaction });
        if (existing && ["pending", "approved"].includes(existing.status)) throw new SchedulingError("Your crew request already exists", 409);
        if ((await approvedCrew(flight, transaction)).length >= 2) throw new SchedulingError("This flight's crew is full", 409);
        if (existing) await existing.update({ status: "pending", reviewed_by: null, reviewed_at: null, review_reason: null }, { transaction });
        else await LiveFlightMember.create({ flight_id: flight.id, pilot_id: actor.id, status: "pending" }, { transaction });
      } else {
        const member = action === "withdraw_join"
          ? await LiveFlightMember.findOne({ where: { flight_id: flight.id, pilot_id: actor.id }, transaction })
          : await LiveFlightMember.findOne({ where: { id: validId(body.member_id, "Crew request"), flight_id: flight.id }, transaction });
        if (!member) throw new SchedulingError("Crew request not found", 404);
        if (!["pending", "approved"].includes(member.status)) throw new SchedulingError("This crew request has already been decided", 409);
        const wasApproved = member.status === "approved";
        if (action !== "withdraw_join") requireCaptain(actor, flight);
        if (action === "reject_join" && !reason) throw new SchedulingError("A rejection reason is required");
        if (action === "approve_join") {
          if (wasApproved) throw new SchedulingError("This pilot is already approved", 409);
          await eligible(member.pilot_id, transaction);
          if ((await approvedCrew(flight, transaction)).length >= 2) throw new SchedulingError("This flight's crew is full", 409);
          await checkPilotBookings([member.pilot_id], flight, transaction);
        }
        await member.update({ status: action === "approve_join" ? "approved" : action === "withdraw_join" ? "withdrawn" : "rejected", reviewed_by: actor.id, reviewed_at: new Date(), review_reason: reason }, { transaction });
        if (wasApproved || action === "approve_join") await bumpAndQueue(flight, aircraft, transaction);
      }
    } else throw new SchedulingError("Unknown scheduling action");
    await event(aircraft, flight, actor, action, { reason, before, after: flightState(flight), actual_arrival: body.actual_arrival ?? null, member_id: body.member_id ?? null }, transaction);
    return { flight_id: flight.id };
  });
}

export async function changeAircraft(actor: SchedulingActor, body: Body) {
  if (!actor.admin) throw new SchedulingError("Scheduling administrator access required", 403);
  return mutate(actor, body, async (transaction, aircraft) => {
    const adding = body.action === "add_aircraft";
    if (!adding && !aircraft) throw new SchedulingError("Select a live aircraft");
    const payload: Body = {};
    if (adding || has(body, "registration")) {
      const registration = text(body.registration, 24, "Registration")?.toUpperCase();
      if (!registration || !/^[A-Z0-9-]+$/.test(registration)) throw new SchedulingError("Registration may contain letters, numbers, and hyphens");
      payload.registration = registration;
    }
    if (adding || has(body, "aircraft_id")) {
      const aircraftId = validId(body.aircraft_id, "Aircraft type");
      const catalog = await models.Aircraft.findOne({ where: { id: aircraftId, status: 1 }, transaction });
      if (!catalog) throw new SchedulingError("Select an active aircraft type");
      payload.aircraft_id = aircraftId;
    }
    if (adding || has(body, "current_airport")) {
      payload.current_airport = airport(body.current_airport, true);
      payload.location_updated_by = actor.id;
      payload.location_updated_at = new Date();
    }
    if (has(body, "active")) {
      if (typeof body.active !== "boolean") throw new SchedulingError("Active must be true or false");
      payload.active = body.active;
    }
    if (has(body, "if_aircraft_id")) {
      const binding = text(body.if_aircraft_id, 36, "IF aircraft ID");
      if (binding) {
        if (![process.env.IF_LIVE_PREVIEW_ENABLED, process.env.IF_LIVE_AUTO_PUBLISH_ENABLED, process.env.IF_LIVE_DURABLE_BINDINGS_ALLOWED].every(value => value === "true")) throw new SchedulingError("IF aircraft binding requires enabled preview publishing and permitted identifier retention", 409);
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(binding)) throw new SchedulingError("Invalid persistent IF aircraft ID");
        const connection = await IfLiveConnection.findByPk(1, { transaction });
        if (!connection?.organization_id || connection.state !== "connected") throw new SchedulingError("Connect an IF organization first", 409);
      }
      if (aircraft?.if_aircraft_id && binding !== aircraft.if_aircraft_id) {
        const flights = await LiveFlight.findAll({ where: { live_aircraft_id: aircraft.id }, transaction });
        const unsettled = flights.some(flight => RESERVED_STATUSES.includes(flight.status as "approved" | "in_progress")
          || (flight.status !== "completed" && (flight.if_schedule_id || ["queued", "processing", "publishing", "reconciliation", "partial", "conflict", "failed", "disabled"].includes(flight.publishing_state))));
        const unfinishedJobs = flights.length ? await IfLiveOutbox.count({ where: { flight_id: { [Op.in]: flights.map(flight => flight.id) }, state: { [Op.ne]: "done" } }, transaction }) : 0;
        if (unsettled || unfinishedJobs) throw new SchedulingError("Resolve or remove existing IF reservations before changing this binding", 409);
      }
      payload.if_aircraft_id = binding;
    }
    if (aircraft) {
      const flights = await queue(aircraft.id, transaction);
      if (flights.some(flight => flight.status === "in_progress")) throw new SchedulingError("Finish the in-progress flight before changing this aircraft", 409);
      if (has(payload, "aircraft_id") && payload.aircraft_id !== aircraft.aircraft_id && flights.length) throw new SchedulingError("Cancel outstanding flights before changing aircraft type", 409);
      await aircraft.update(payload, { transaction });
      if (!aircraft.active) {
        for (const flight of flights) {
          await flight.update({ status: "needs_review", review_reason: "Aircraft deactivated" }, { transaction });
          await bumpAndQueue(flight, aircraft, transaction);
        }
      } else {
        await repairQueue(aircraft, actor, transaction);
        if (has(payload, "if_aircraft_id")) for (const flight of await queue(aircraft.id, transaction)) await bumpAndQueue(flight, aircraft, transaction);
      }
    } else aircraft = await LiveAircraft.create(payload, { transaction });
    await event(aircraft, null, actor, adding ? "aircraft_added" : "aircraft_updated", payload, transaction);
    return { live_aircraft_id: aircraft.id };
  });
}

export async function schedulingSnapshot(actor: SchedulingActor) {
  const catalog = await models.Aircraft.findAll({ attributes: ["id", "name", "liveryname", "status"], raw: true });
  const pilots = await models.Pilot.findAll({ attributes: ["id", "name", "callsign", "ifuserid", "status"], raw: true });
  const awardId = livePilotAwardId();
  const grants = awardId ? await models.AwardGranted.findAll({ where: { awardid: awardId }, attributes: ["pilotid"], raw: true }) : [];
  const awarded = new Set(grants.map(grant => Number(grant.pilotid)));
  const pilotMap = new Map(pilots.map(pilot => [pilot.id, { id: pilot.id, name: pilot.name, callsign: pilot.callsign, eligible: pilot.status === 1 && awarded.has(pilot.id), ifuserid: pilot.ifuserid }]));
  const allAircraft = await LiveAircraft.findAll({ order: [["registration", "ASC"]], raw: true });
  const flights = await LiveFlight.findAll({ where: { [Op.or]: [{ status: { [Op.in]: ["pending", "approved", "in_progress", "needs_review"] } }, { updated_at: { [Op.gte]: new Date(Date.now() - 30 * 86400000) } }] }, order: [["scheduled_departure", "ASC"], ["id", "ASC"]], raw: true });
  const memberships = flights.length ? await LiveFlightMember.findAll({ where: { flight_id: { [Op.in]: flights.map(flight => flight.id) } }, raw: true }) : [];
  const catalogMap = new Map(catalog.map(item => [item.id, item]));
  const aircraft = allAircraft.filter(item => actor.admin || item.active).map(item => ({
    ...item, name: catalogMap.get(item.aircraft_id)?.name ?? "Aircraft", liveryname: catalogMap.get(item.aircraft_id)?.liveryname ?? null,
    projected_airport: orderedQueue(flights.filter(flight => flight.live_aircraft_id === item.id && RESERVED_STATUSES.includes(flight.status as "approved" | "in_progress"))).at(-1)?.arrival ?? item.current_airport,
  }));
  const visibleFlights = flights.filter(flight => actor.admin || !["pending", "rejected", "cancelled"].includes(flight.status) || flight.captain_id === actor.id || memberships.some(member => member.flight_id === flight.id && member.pilot_id === actor.id));
  return {
    aircraft, pilotId: actor.id, canAdmin: actor.admin,
    flights: visibleFlights.map(flight => {
      const crew = memberships.filter(member => member.flight_id === flight.id);
      const issues = [flight.captain_id, ...crew.filter(member => member.status === "approved").map(member => member.pilot_id)].filter(id => !pilotMap.get(id)?.eligible).map(id => `${pilotMap.get(id)?.name ?? "Pilot"} no longer has live pilot access`);
      const captain = pilotMap.get(flight.captain_id);
      return { ...flight, captain: captain && { id: captain.id, name: captain.name, callsign: captain.callsign }, eligibility_issues: issues,
        members: crew.filter(member => actor.admin || actor.id === flight.captain_id || member.status === "approved" || member.pilot_id === actor.id).map(member => { const pilot = pilotMap.get(member.pilot_id); return { ...member, pilot: pilot && { id: pilot.id, name: pilot.name, callsign: pilot.callsign } }; }),
      };
    }),
    ...(actor.admin ? { pilots: [...pilotMap.values()], catalog: catalog.filter(item => item.status === 1), configuration: { liveAwardConfigured: Boolean(awardId) } } : {}),
  };
}

export function schedulingFailure(error: unknown) {
  if (error instanceof SchedulingError) return { status: error.status, error: error.message };
  if (error instanceof UniqueConstraintError) return { status: 409, error: "This registration, IF binding, or request already exists" };
  const dbError = (error as { original?: { code?: string; sqlMessage?: string } })?.original;
  const dbCode = dbError?.code;
  if (dbCode === "ER_NO_SUCH_TABLE" || dbCode === "ER_BAD_FIELD_ERROR") {
    // Keep schema identifiers useful for deployment diagnosis without logging
    // SQL statements, bound values, credentials, or the complete driver error.
    const identifier = dbError?.sqlMessage?.match(/^(?:Table|Unknown column) '([A-Za-z0-9_.]+)'/)?.[1];
    console.error("[Scheduling] Database schema mismatch", { code: dbCode, identifier });
    return { status: 503, error: dbCode === "ER_NO_SUCH_TABLE"
      ? "Live scheduling needs its SQL migration. Apply migrations/20261002_live_scheduling.sql first."
      : "Live scheduling has a database column mismatch. An administrator needs to check the deployed app and database schema." };
  }
  console.error("[Scheduling] Operation failed", error instanceof Error ? error.name : "Unknown error");
  return { status: 500, error: "Unable to complete this scheduling operation" };
}
