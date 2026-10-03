import { Op, QueryTypes, type Transaction } from "sequelize";
import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { IfLiveConnection, IfLiveOutbox, LiveAircraft, LiveFlight, LiveFlightMember, LiveScheduleEvent } from "@/lib/scheduling/models";
import { canAccessLiveScheduling } from "@/lib/scheduling/access";
import { getIfAccessToken } from "./connection";
import { IfLiveError, getIfLiveConfig, isIfUuid, requireIfLiveConfig } from "./config";
import { createIfSchedule, deleteIfSchedule, getIfFleet, getIfSchedules, putIfCrew, removeIfCrew, reorderIfSchedule, updateIfSchedule } from "./client";
import { buildIfPayload, synchronizeIfFlight, type PublishAction, type PublishedPayload } from "./sync";
import type { IfCrew } from "./types";
import { ifBudgetRemainingMs, withIfRequestBudget } from "./request-budget";
import { planIfSequence } from "./sequence";

const MAX_ATTEMPTS = 5;
const LEASE_MS = 180_000;
const REMOVAL_STATES = new Set(["cancelled", "rejected", "needs_review"]);

async function mutationMutex(transaction: Transaction) {
  const rows = await sequelize.query<{ name: string }>("SELECT name FROM options WHERE name = 'live_scheduling_mutex' FOR UPDATE", { transaction, type: QueryTypes.SELECT });
  if (!rows.length) throw new IfLiveError("The scheduling mutex migration has not been installed", "configuration");
}

async function assertCurrentPublish(flight: LiveFlight, aircraft: LiveAircraft, organizationId: string) {
  await sequelize.transaction(async transaction => {
    await mutationMutex(transaction);
    const [current, binding, connection] = await Promise.all([
      LiveFlight.findByPk(flight.id, { transaction }), LiveAircraft.findByPk(aircraft.id, { transaction }), IfLiveConnection.findByPk(1, { transaction }),
    ]);
    if (!current || current.revision !== flight.revision || current.status !== flight.status || !binding || binding.if_aircraft_id !== aircraft.if_aircraft_id ||
        connection?.organization_id !== organizationId || connection.state !== "connected") throw new IfLiveError("A newer local change superseded this publish; the latest revision remains queued", "superseded", 409);
    if (current.status === "approved") {
      const members = await LiveFlightMember.findAll({ where: { flight_id: current.id, status: "approved" }, attributes: ["pilot_id"], transaction });
      const pilotIds = [...new Set([current.captain_id, ...members.map(row => row.pilot_id)])].sort((left, right) => left - right);
      if (pilotIds.length > 3) throw new IfLiveError("IF reservations permit at most three approved crew", "crew", 409);
      // Match local mutation lock order, and release these locks before the HTTP write.
      for (const pilotId of pilotIds) {
        if (!await canAccessLiveScheduling(pilotId, undefined, transaction)) throw new IfLiveError("Every approved crew member must still hold the Live Pilot award and an active account", "crew", 409);
      }
    }
  });
}

async function authoredPayload(flight: LiveFlight) {
  const members = await LiveFlightMember.findAll({ where: { flight_id: flight.id, status: "approved" }, attributes: ["pilot_id"], raw: true });
  const pilotIds = [flight.captain_id, ...members.map(row => row.pilot_id)].filter((value, index, all) => all.indexOf(value) === index);
  const allowed = await Promise.all(pilotIds.map(pilotId => canAccessLiveScheduling(pilotId)));
  if (allowed.some(value => !value)) throw new IfLiveError("Every approved crew member must still hold the Live Pilot award and an active account", "crew", 409);
  const pilots = await models.Pilot.findAll({ where: { id: { [Op.in]: pilotIds } }, attributes: ["id", "ifuserid"], raw: true });
  const crew: IfCrew[] = pilotIds.map(pilotId => {
    const pilot = pilots.find(row => row.id === pilotId);
    const userId = pilot?.ifuserid;
    if (!isIfUuid(userId)) throw new IfLiveError("Approved crew need valid IF user IDs before this flight can publish", "crew", 409);
    return { userId, role: pilotId === flight.captain_id ? 0 : 1 };
  });
  return buildIfPayload(flight, crew);
}

async function checkpoint(flightId: number, remoteId: string, authored: PublishedPayload) {
  // No upstream response fields besides the explicitly allowed binding are persisted here.
  await sequelize.transaction(async transaction => {
    await mutationMutex(transaction);
    await LiveFlight.update({ if_schedule_id: remoteId, last_published_payload: authored }, { where: { id: flightId }, transaction });
  });
}

async function finishJob(jobId: number, flightId: number, revision: number, payload: PublishedPayload | null, remoteId: string | null) {
  await sequelize.transaction(async transaction => {
    await mutationMutex(transaction);
    const flight = await LiveFlight.findByPk(flightId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!flight) return;
    await flight.update({ published_revision: Math.max(flight.published_revision, revision), if_schedule_id: remoteId, last_published_payload: payload, publishing_state: flight.revision === revision ? "published" : "queued", error: null }, { transaction });
    await IfLiveOutbox.update({ state: "done", action: "sync", lease_until: null, error: null }, { where: { id: jobId }, transaction });
    await IfLiveOutbox.update({ state: "done", lease_until: null }, { where: { flight_id: flightId, revision: { [Op.lt]: revision }, state: { [Op.in]: ["queued", "failed", "reconciliation", "conflict"] } }, transaction });
    await LiveScheduleEvent.create({ live_aircraft_id: flight.live_aircraft_id, flight_id: flightId, actor_id: null, action: remoteId ? "if_published" : "if_reservation_removed", details: { revision } }, { transaction });
  });
}

async function failJob(job: IfLiveOutbox, flightId: number, error: unknown) {
  const value = error instanceof IfLiveError ? error : new IfLiveError("IF publishing failed; retry after checking the integration", "unavailable", 503);
  const needsReconciliation = value.uncertainWrite || value.code === "reconciliation";
  const conflict = value.code === "conflict";
  const superseded = value.code === "superseded";
  const terminal = needsReconciliation || conflict || job.attempts >= MAX_ATTEMPTS || ["crew", "validation", "forbidden", "reauth_required", "retention", "binding", "not_connected", "access_suspended", "upstream_rejected"].includes(value.code);
  const state = superseded ? "done" : needsReconciliation ? "reconciliation" : conflict ? "conflict" : terminal ? "failed" : "queued";
  const delay = Math.max(value.retryAfterSeconds, Math.min(3600, 30 * 2 ** Math.max(0, job.attempts - 1)));
  await sequelize.transaction(async transaction => {
    await mutationMutex(transaction);
    await IfLiveOutbox.update({ state, lease_until: null, next_attempt_at: new Date(Date.now() + delay * 1000), error: value.message.slice(0, 500) }, { where: { id: job.id }, transaction });
    if (!superseded) await LiveFlight.update({ publishing_state: state === "queued" ? "queued" : state, error: value.message.slice(0, 500) }, { where: { id: flightId, revision: job.revision }, transaction });
  });
  return state;
}

async function publishClaimedJob(job: IfLiveOutbox) {
  const flight = await LiveFlight.findByPk(job.flight_id);
  if (!flight) { await job.update({ state: "done", lease_until: null }); return "skipped"; }
  if (flight.revision !== job.revision || !["approved", ...REMOVAL_STATES].includes(flight.status)) {
    await job.update({ state: "done", lease_until: null }); return "skipped";
  }
  const connection = await IfLiveConnection.findByPk(1); const aircraft = await LiveAircraft.findByPk(flight.live_aircraft_id);
  if (!connection?.organization_id || !aircraft?.if_aircraft_id) throw new IfLiveError("Bind this local aircraft to the connected IF organization's aircraft before publishing", "binding", 409);
  if (!aircraft.active && flight.status === "approved") throw new IfLiveError("The local aircraft is inactive", "binding", 409);
  const token = await getIfAccessToken(); const fleet = await getIfFleet(token, connection.organization_id);
  const remoteAircraft = fleet.find(row => row.id.toLowerCase() === aircraft.if_aircraft_id!.toLowerCase());
  if (!remoteAircraft || remoteAircraft.organizationId.toLowerCase() !== connection.organization_id.toLowerCase()) throw new IfLiveError("The IF aircraft is no longer in the connected organization", "binding", 409);
  if (!remoteAircraft.isFleetActiveSlot && flight.status === "approved") throw new IfLiveError("The IF aircraft is in storage; activate it in IF before publishing", "binding", 409);
  const desired = flight.status === "approved" ? await authoredPayload(flight) : null;
  const schedules = await getIfSchedules(token, aircraft.if_aircraft_id, { fresh: true });
  const uncertain = flight.publishing_state === "reconciliation" || await IfLiveOutbox.count({ where: { flight_id: flight.id, state: "reconciliation" } }) > 0;
  const action = (job.get("action") ?? "sync") as PublishAction;
  const beforeWrite = () => assertCurrentPublish(flight, aircraft, connection.organization_id!);
  const result = await synchronizeIfFlight({ publicId: flight.public_id, remoteId: flight.if_schedule_id, schedules, desired,
    previous: flight.last_published_payload as PublishedPayload | null, action, uncertainCreation: uncertain,
    api: {
      create: async body => { await beforeWrite(); return createIfSchedule(token, aircraft.if_aircraft_id!, body); },
      update: async (id, body) => { await beforeWrite(); return updateIfSchedule(token, aircraft.if_aircraft_id!, id, body); },
      remove: async id => { await beforeWrite(); return deleteIfSchedule(token, aircraft.if_aircraft_id!, id); },
      putCrew: async (id, crew) => { await beforeWrite(); return putIfCrew(token, aircraft.if_aircraft_id!, id, crew); },
      removeCrew: async (id, userId) => { await beforeWrite(); return removeIfCrew(token, aircraft.if_aircraft_id!, id, userId); },
    }, checkpoint: (id, payload) => checkpoint(flight.id, id, payload),
  });
  if (desired && result.remoteId) {
    const currentSchedules = await getIfSchedules(token, aircraft.if_aircraft_id, { fresh: true });
    const localOrder = await LiveFlight.findAll({ where: { live_aircraft_id: flight.live_aircraft_id, status: { [Op.in]: ["approved", "in_progress"] } }, attributes: ["public_id"], order: [["scheduled_departure", "ASC"], ["id", "ASC"]] });
    const reorder = planIfSequence(currentSchedules, localOrder, result.remoteId);
    if (reorder) { await beforeWrite(); await reorderIfSchedule(token, aircraft.if_aircraft_id, reorder.scheduleId, reorder.afterId); }
  }
  await finishJob(job.id, flight.id, job.revision, desired, result.remoteId);
  return "published";
}

/** Only called by the protected worker endpoint. Each invocation performs at most two jobs. */
export async function runIfLivePublisher() {
  return withIfRequestBudget(25_000, runBoundedIfLivePublisher);
}

async function runBoundedIfLivePublisher() {
  const config = getIfLiveConfig();
  if (!config.configured || !config.autoPublishEnabled || !config.durableBindingsAllowed) return { processed: 0, published: 0, disabled: true, reasons: [...config.disabledReasons, ...(!config.autoPublishEnabled ? ["Automatic IF publishing is disabled"] : []), ...(!config.durableBindingsAllowed ? ["Durable IF mapping retention has not been authorized"] : [])] };
  requireIfLiveConfig(true);
  // A crashed lease may have sent POST. Require reconciliation rather than automatically resending it.
  const expired = await IfLiveOutbox.findAll({ where: { state: "processing", lease_until: { [Op.lt]: new Date() } }, limit: 20 });
  for (const job of expired) {
    await sequelize.transaction(async transaction => {
      await mutationMutex(transaction);
      const message = "The publishing worker stopped before confirmation; reconcile the IF schedule before retrying";
      const [updated] = await IfLiveOutbox.update({ state: "reconciliation", lease_until: null, error: message }, { where: { id: job.id, state: "processing", lease_until: { [Op.lt]: new Date() } }, transaction });
      if (updated) await LiveFlight.update({ publishing_state: "reconciliation", error: message }, { where: { id: job.flight_id, revision: job.revision }, transaction });
    });
  }
  const candidates = await IfLiveOutbox.findAll({ where: { state: "queued", next_attempt_at: { [Op.lte]: new Date() }, attempts: { [Op.lt]: MAX_ATTEMPTS } }, order: [["created_at", "ASC"], ["id", "ASC"]], limit: 10 });
  let processed = 0; let published = 0; const states: Record<string, number> = {};
  for (const candidate of candidates) {
    if (processed >= 2 || ifBudgetRemainingMs() < 1000) break;
    const flight = await LiveFlight.findByPk(candidate.flight_id); if (!flight) { await candidate.update({ state: "done" }); continue; }
    const lockName = `wnc_if_aircraft_${flight.live_aircraft_id}`;
    // A transaction pins the advisory lock to one pooled MySQL connection. No aircraft row lock is held during HTTP calls.
    const lockTransaction = await sequelize.transaction(); let acquired = false;
    try {
      const rows = await sequelize.query<{ acquired: number }>("SELECT GET_LOCK(:lockName, 0) AS acquired", { replacements: { lockName }, type: QueryTypes.SELECT, transaction: lockTransaction });
      acquired = Number(rows[0]?.acquired) === 1; if (!acquired) continue;
      const claimed = await sequelize.transaction(async transaction => {
        await mutationMutex(transaction);
        const job = await IfLiveOutbox.findByPk(candidate.id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!job || job.state !== "queued" || job.next_attempt_at > new Date() || job.attempts >= MAX_ATTEMPTS) return null;
        // Do not process a later chain leg ahead of an earlier uncompleted publish job on this aircraft.
        const earlierFlights = await LiveFlight.findAll({ where: { live_aircraft_id: flight.live_aircraft_id, scheduled_departure: { [Op.lt]: flight.scheduled_departure }, status: "approved" }, attributes: ["id"], transaction });
        if (flight.status === "approved" && earlierFlights.length && await IfLiveOutbox.count({ where: { flight_id: { [Op.in]: earlierFlights.map(row => row.id) }, state: { [Op.ne]: "done" } }, transaction }) > 0) return null;
        await job.update({ state: "processing", attempts: job.attempts + 1, lease_until: new Date(Date.now() + LEASE_MS) }, { transaction });
        return job;
      });
      if (!claimed) continue;
      processed += 1;
      try { const state = await publishClaimedJob(claimed); states[state] = (states[state] ?? 0) + 1; if (state === "published") published += 1; }
      catch (error) { const state = await failJob(claimed, claimed.flight_id, error); states[state] = (states[state] ?? 0) + 1; }
    } finally {
      try {
        if (acquired) await sequelize.query("SELECT RELEASE_LOCK(:lockName)", { replacements: { lockName }, type: QueryTypes.SELECT, transaction: lockTransaction });
      } finally { await lockTransaction.commit(); }
    }
  }
  return { processed, published, disabled: false, states };
}

export async function retryIfPublish(flightId: number, action: "retry" | "overwrite" | "recreate", actorId: number) {
  requireIfLiveConfig(true);
  await sequelize.transaction(async transaction => {
    await mutationMutex(transaction);
    const flight = await LiveFlight.findByPk(flightId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!flight) throw new IfLiveError("Flight not found", "not_found", 404);
    if (!["approved", ...REMOVAL_STATES].includes(flight.status)) throw new IfLiveError("Only planned or cancelled flights can be republished", "validation", 409);
    const current = await IfLiveOutbox.findOne({ where: { flight_id: flight.id, revision: flight.revision }, transaction, lock: transaction.LOCK.UPDATE });
    if (current?.state === "processing") throw new IfLiveError("This flight is currently publishing; wait for the worker to finish", "conflict", 409);
    const values = { state: "queued", action: action === "retry" ? "sync" : action, attempts: 0, next_attempt_at: new Date(), lease_until: null, error: null };
    if (current) await current.update(values, { transaction });
    else await IfLiveOutbox.create({ flight_id: flight.id, revision: flight.revision, ...values }, { transaction });
    await flight.update({ publishing_state: flight.publishing_state === "reconciliation" ? "reconciliation" : "queued", error: null }, { transaction });
    await LiveScheduleEvent.create({ live_aircraft_id: flight.live_aircraft_id, flight_id: flight.id, actor_id: actorId, action: `if_${action}_requested`, details: { revision: flight.revision } }, { transaction });
  });
}
