import { IfLiveError, isIfUuid } from "./config";
import type { AuthoredIfPayload, IfCrew, IfSchedule, IfScheduleRequest } from "./types";
import { ifScheduleTimeMs, isUnsetIfScheduleTime, meaningfulIfScheduleTime } from "./schedule-time";

export type IfPublishedPayload = AuthoredIfPayload & { crewPending?: boolean; previousCrew?: IfCrew[] };
export type IfLocalFlight = {
  public_id: string;
  departure: string;
  arrival: string;
  scheduled_departure: Date | string | null;
  scheduled_arrival: Date | string | null;
  queue_order?: number | null;
  status?: string;
  if_schedule_id?: string | null;
  last_published_payload?: IfPublishedPayload | null;
  revision?: number;
  published_revision?: number;
};
export type IfItineraryLeg = {
  publicId: string | null;
  remoteId: string | null;
  origin: string;
  destination: string;
  departure: number | null;
  arrival: number | null;
  status: number | null;
};

export function scheduleMarker(publicId: string) {
  if (!isIfUuid(publicId)) throw new IfLiveError("Local schedule marker is invalid", "validation", 400);
  return `[WNC schedule:${publicId.toLowerCase()}]`;
}

function normalizedSchedule(schedule: IfScheduleRequest) {
  return { callsign: schedule.callsign, flightType: schedule.flightType, originIcao: schedule.originIcao.toUpperCase(), destinationIcao: schedule.destinationIcao.toUpperCase(),
    scheduledDepartureUtc: meaningfulIfScheduleTime(schedule.scheduledDepartureUtc), scheduledArrivalUtc: meaningfulIfScheduleTime(schedule.scheduledArrivalUtc),
    briefing: schedule.briefing || null, flightPlan: schedule.flightPlan || null };
}
export function normalizedCrew(crew: IfCrew[]) { return crew.map(row => ({ userId: row.userId.toLowerCase(), role: row.role })).sort((a, b) => a.userId.localeCompare(b.userId)); }
export function sameIfSchedule(left: IfScheduleRequest, right: IfScheduleRequest) { return JSON.stringify(normalizedSchedule(left)) === JSON.stringify(normalizedSchedule(right)); }
export function sameIfCrew(left: IfCrew[], right: IfCrew[]) { return JSON.stringify(normalizedCrew(left)) === JSON.stringify(normalizedCrew(right)); }
export function crewIsSubset(crew: IfCrew[], expected: IfCrew[]) { return crew.every(row => expected.some(wanted => wanted.userId.toLowerCase() === row.userId.toLowerCase() && wanted.role === row.role)); }
export function matchesIfPublishedPayload(remote: IfSchedule, expected: IfPublishedPayload) {
  return sameIfSchedule(remote, expected.schedule) && (expected.crewPending
    ? crewIsSubset(remote.crew, [...expected.crew, ...(expected.previousCrew ?? [])])
    : sameIfCrew(remote.crew, expected.crew));
}
export function isIfTerminal(status: number) { return status === 9 || status === 11; }
const REMOVAL_STATUSES = new Set(["needs_review", "cancelled", "rejected"]);

export function orderedIfSchedules(schedules: readonly IfSchedule[]): IfSchedule[] {
  const active = schedules.filter(row => !isIfTerminal(row.status));
  if (!active.every(row => Number.isSafeInteger(row.sequence))) return [...schedules];
  if (new Set(active.map(row => row.sequence)).size !== active.length) throw new IfLiveError("IF returned duplicate schedule sequence numbers; refresh and review the aircraft queue", "conflict", 409);
  return [...active].sort((a, b) => a.sequence! - b.sequence!).concat(schedules.filter(row => isIfTerminal(row.status)));
}

export function orderedIfLocalFlights(flights: readonly IfLocalFlight[]): IfLocalFlight[] {
  return [...flights].sort((a, b) => {
    if (Number.isSafeInteger(a.queue_order) && Number.isSafeInteger(b.queue_order)) return a.queue_order! - b.queue_order!;
    const left = ifScheduleTimeMs(a.scheduled_departure); const right = ifScheduleTimeMs(b.scheduled_departure);
    return left !== null && right !== null ? left - right : 0;
  });
}

function leg(origin: string, destination: string, departure: Date | string | null | undefined, arrival: Date | string | null | undefined, publicId: string | null, remoteId: string | null, status: number | null): IfItineraryLeg {
  const value = { origin: origin.toUpperCase(), destination: destination.toUpperCase(), departure: ifScheduleTimeMs(departure), arrival: ifScheduleTimeMs(arrival), publicId, remoteId, status };
  if (!/^[A-Z0-9]{1,8}$/.test(value.origin) || !/^[A-Z0-9]{1,8}$/.test(value.destination) ||
      (value.departure === null && !isUnsetIfScheduleTime(departure)) || (value.arrival === null && !isUnsetIfScheduleTime(arrival)) ||
      (value.departure === null) !== (value.arrival === null) || (value.departure !== null && value.arrival !== null && value.arrival <= value.departure)) {
    throw new IfLiveError("An active IF or local reservation has an invalid route or time interval; review the aircraft itinerary", "conflict", 409);
  }
  return value;
}

/** Keep external/active boundaries fixed; only order this app's unstarted legs. */
function queueAwareItinerary(remote: IfItineraryLeg[], extra: IfItineraryLeg[], local: IfLocalFlight[]) {
  const ranks = new Map(orderedIfLocalFlights(local).map((flight, index) => [flight.public_id.toLowerCase(), index]));
  const rank = (row: IfItineraryLeg) => row.publicId ? ranks.get(row.publicId.toLowerCase()) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
  const result = [...remote];
  for (const row of [...extra].sort((a, b) => rank(a) - rank(b))) {
    const next = result.findIndex(other => other.publicId && rank(other) > rank(row));
    result.splice(next === -1 ? result.length : next, 0, row);
  }
  let start = 0;
  while (start < result.length) {
    if (!result[start].publicId || ![null, 1].includes(result[start].status)) { start += 1; continue; }
    let end = start + 1;
    while (end < result.length && result[end].publicId && [null, 1].includes(result[end].status)) end += 1;
    const segment = result.slice(start, end).sort((a, b) => rank(a) - rank(b));
    result.splice(start, segment.length, ...segment); start = end;
  }
  return result;
}

/** Validate the intended aircraft route before writing; unpublished local legs remain part of the chain. */
export function assertIfItinerary(input: {
  schedules: IfSchedule[];
  localFlights?: IfLocalFlight[];
  target?: { publicId: string; desired: IfScheduleRequest | null };
  requirePublishedPredecessors?: boolean;
  requireUnstartedReservations?: boolean;
  allowStartedReservations?: boolean;
}) {
  const known = (input.localFlights ?? []).filter(flight => !flight.status || ["approved", "in_progress"].includes(flight.status) || REMOVAL_STATUSES.has(flight.status));
  const local = known.filter(flight => !flight.status || !REMOVAL_STATUSES.has(flight.status));
  const active = orderedIfSchedules(input.schedules).filter(row => !isIfTerminal(row.status));
  const targetMarker = input.target ? scheduleMarker(input.target.publicId) : null;
  const targetRemote = targetMarker ? active.find(row => row.briefing?.includes(targetMarker)) : undefined;
  const mapped = new Map<IfSchedule, IfLocalFlight>();
  const found = new Set<string>();
  for (const flight of known) {
    const marker = scheduleMarker(flight.public_id);
    const marked = active.filter(row => row.briefing?.includes(marker));
    if (marked.length > 1) throw new IfLiveError("Multiple IF reservations share a local reference; resolve them before publishing", "conflict", 409);
    const remote = marked[0];
    const isTarget = flight.public_id.toLowerCase() === input.target?.publicId.toLowerCase();
    const bound = flight.if_schedule_id ? active.find(row => row.id.toLowerCase() === flight.if_schedule_id!.toLowerCase()) : undefined;
    if (!isTarget && bound && bound !== remote) throw new IfLiveError("Another linked IF reservation lost this app's reference; reconcile it before publishing", "conflict", 409);
    if (!remote) continue;
    if (!isTarget && flight.if_schedule_id && flight.if_schedule_id.toLowerCase() !== remote.id.toLowerCase()) {
      throw new IfLiveError("A local flight's IF reservation identifier changed; reconcile that flight first", "conflict", 409);
    }
    mapped.set(remote, flight); found.add(flight.public_id.toLowerCase());
    if (isTarget) continue;
    if (flight.status && REMOVAL_STATUSES.has(flight.status) && !flight.last_published_payload) {
      throw new IfLiveError("A pending IF removal has no authored checkpoint; review its ownership and crew before publishing", "conflict", 409);
    }
    const unchanged = flight.last_published_payload
      ? matchesIfPublishedPayload(remote, flight.last_published_payload)
      : remote.originIcao.toUpperCase() === flight.departure.toUpperCase() && remote.destinationIcao.toUpperCase() === flight.arrival.toUpperCase() &&
        ifScheduleTimeMs(remote.scheduledDepartureUtc) === ifScheduleTimeMs(flight.scheduled_departure) && ifScheduleTimeMs(remote.scheduledArrivalUtc) === ifScheduleTimeMs(flight.scheduled_arrival);
    if (!unchanged) throw new IfLiveError("Another managed IF reservation changed outside this app; reconcile its route or crew before publishing", "conflict", 409);
  }
  const remoteLegs: IfItineraryLeg[] = []; const extra: IfItineraryLeg[] = [];
  let target: IfItineraryLeg | undefined;
  if (input.target?.desired) {
    const desired = input.target.desired;
    target = leg(desired.originIcao, desired.destinationIcao, desired.scheduledDepartureUtc, desired.scheduledArrivalUtc, input.target.publicId, targetRemote?.id ?? null, targetRemote?.status ?? null);
  }
  for (const remote of active) {
    if (remote === targetRemote) { if (target) remoteLegs.push(target); continue; }
    if (!(input.allowStartedReservations ? [1, 2, 3, 4, 6, 7, 8, 10] : [1, 6]).includes(remote.status) || (input.requireUnstartedReservations && remote.status !== 1)) {
      throw new IfLiveError("Another IF reservation has started or has an unsupported state; review the aircraft itinerary", "conflict", 409);
    }
    remoteLegs.push(leg(remote.originIcao, remote.destinationIcao, remote.scheduledDepartureUtc, remote.scheduledArrivalUtc, mapped.get(remote)?.public_id ?? null, remote.id, remote.status));
  }
  for (const flight of local) {
    if (found.has(flight.public_id.toLowerCase()) || flight.public_id.toLowerCase() === input.target?.publicId.toLowerCase()) continue;
    extra.push(leg(flight.departure, flight.arrival, flight.scheduled_departure, flight.scheduled_arrival, flight.public_id, null, null));
  }
  if (target && !targetRemote) extra.push(target);
  const combined = [...remoteLegs, ...extra];
  const hasExplicitOrder = local.some(flight => Number.isSafeInteger(flight.queue_order));
  const itinerary = !hasExplicitOrder && combined.every(row => row.departure !== null && row.arrival !== null)
    ? combined.sort((left, right) => left.departure! - right.departure! || left.arrival! - right.arrival!)
    : queueAwareItinerary(remoteLegs, extra, local);
  const pendingRemovals = new Set([...mapped].filter(([remote, flight]) => remote !== targetRemote && flight.status && REMOVAL_STATUSES.has(flight.status)).map(([remote]) => remote.id));
  if (target && pendingRemovals.size) throw new IfLiveError("Remove the aircraft's pending owned IF reservations before publishing this amendment", "removal_pending", 409);
  // Removing the first planned leg must not silently strand a remaining foreign flight at its destination.
  const origin = input.target && !input.target.desired && targetRemote && active[0] === targetRemote
    ? targetRemote.originIcao.toUpperCase() : null;
  const routeConflict = (rows: IfItineraryLeg[]) => {
    if (origin && rows.length && rows[0].origin !== origin) return new IfLiveError(`Removing this reservation would leave the aircraft at ${origin}, but the next flight departs from ${rows[0].origin}`, "conflict", 409);
    const timed = rows.filter(row => row.departure !== null && row.arrival !== null);
    for (let index = 1; index < timed.length; index += 1) {
      if (timed[index].departure! < timed[index - 1].arrival!) return new IfLiveError("This flight overlaps another active IF or local reservation for the aircraft; review its bookings before publishing", "conflict", 409);
    }
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1]; const next = rows[index];
      if (previous.destination !== next.origin) return new IfLiveError(`The aircraft itinerary is discontinuous: the preceding flight arrives at ${previous.destination}, but the next departs from ${next.origin}`, "conflict", 409);
    }
    return null;
  };
  const conflict = routeConflict(itinerary);
  if (conflict) {
    if (input.target && !input.target.desired && pendingRemovals.size && !routeConflict(itinerary.filter(row => !row.remoteId || !pendingRemovals.has(row.remoteId)))) {
      throw new IfLiveError("Remove the aircraft's downstream owned IF reservations before removing this leg", "removal_pending", 409);
    }
    throw conflict;
  }
  if (target && input.requirePublishedPredecessors) {
    const preceding = itinerary.slice(0, itinerary.indexOf(target));
    if (preceding.some(row => row.publicId && (!row.remoteId || local.some(flight => flight.public_id === row.publicId &&
        flight.revision !== undefined && flight.published_revision !== undefined && flight.revision !== flight.published_revision)))) {
      throw new IfLiveError("Publish the aircraft's preceding local flights before this reservation", "predecessor_pending", 409);
    }
  }
  if (target) {
    const targetIndex = targetRemote ? active.indexOf(targetRemote) : active.length;
    for (let index = 0; index < active.length; index += 1) {
      const other = active[index];
      if (other === targetRemote || (mapped.has(other) && other.status === 1)) continue;
      const otherTime = ifScheduleTimeMs(other.scheduledDepartureUtc);
      if (otherTime !== null && target.departure !== null && ((otherTime > target.departure && index < targetIndex) || (otherTime < target.departure && index > targetIndex))) {
        throw new IfLiveError("The IF queue places this flight on the wrong side of an external or active reservation; reconcile that queue before publishing", "conflict", 409);
      }
    }
  }
  return itinerary;
}
