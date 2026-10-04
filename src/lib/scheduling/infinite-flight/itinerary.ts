import { IfLiveError, isIfUuid } from "./config";
import type { AuthoredIfPayload, IfCrew, IfSchedule, IfScheduleRequest } from "./types";

export type IfPublishedPayload = AuthoredIfPayload & { crewPending?: boolean; previousCrew?: IfCrew[] };
export type IfLocalFlight = {
  public_id: string;
  departure: string;
  arrival: string;
  scheduled_departure: Date | string;
  scheduled_arrival: Date | string;
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
  departure: number;
  arrival: number;
  status: number | null;
};

export function scheduleMarker(publicId: string) {
  if (!isIfUuid(publicId)) throw new IfLiveError("Local schedule marker is invalid", "validation", 400);
  return `[WNC schedule:${publicId.toLowerCase()}]`;
}

function normalizedSchedule(schedule: IfScheduleRequest) {
  return { callsign: schedule.callsign, flightType: schedule.flightType, originIcao: schedule.originIcao.toUpperCase(), destinationIcao: schedule.destinationIcao.toUpperCase(),
    scheduledDepartureUtc: new Date(schedule.scheduledDepartureUtc).toISOString(), scheduledArrivalUtc: new Date(schedule.scheduledArrivalUtc).toISOString(),
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

function leg(origin: string, destination: string, departure: Date | string, arrival: Date | string, publicId: string | null, remoteId: string | null, status: number | null): IfItineraryLeg {
  const value = { origin: origin.toUpperCase(), destination: destination.toUpperCase(), departure: new Date(departure).getTime(), arrival: new Date(arrival).getTime(), publicId, remoteId, status };
  if (!/^[A-Z0-9]{1,8}$/.test(value.origin) || !/^[A-Z0-9]{1,8}$/.test(value.destination) ||
      !Number.isFinite(value.departure) || !Number.isFinite(value.arrival) || value.arrival <= value.departure) {
    throw new IfLiveError("An active IF or local reservation has an invalid route or time interval; review the aircraft itinerary", "conflict", 409);
  }
  return value;
}

/** Validate the intended aircraft route before writing; unpublished local legs remain part of the chain. */
export function assertIfItinerary(input: {
  schedules: IfSchedule[];
  localFlights?: IfLocalFlight[];
  target?: { publicId: string; desired: IfScheduleRequest | null };
  requirePublishedPredecessors?: boolean;
  requireUnstartedReservations?: boolean;
}) {
  const known = (input.localFlights ?? []).filter(flight => !flight.status || ["approved", "in_progress"].includes(flight.status) || REMOVAL_STATUSES.has(flight.status));
  const local = known.filter(flight => !flight.status || !REMOVAL_STATUSES.has(flight.status));
  const active = input.schedules.filter(row => !isIfTerminal(row.status));
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
        Date.parse(remote.scheduledDepartureUtc) === new Date(flight.scheduled_departure).getTime() && Date.parse(remote.scheduledArrivalUtc) === new Date(flight.scheduled_arrival).getTime();
    if (!unchanged) throw new IfLiveError("Another managed IF reservation changed outside this app; reconcile its route or crew before publishing", "conflict", 409);
  }
  const itinerary: IfItineraryLeg[] = [];
  for (const remote of active) {
    if (remote === targetRemote) continue;
    if (![1, 6].includes(remote.status) || (input.requireUnstartedReservations && remote.status !== 1)) {
      throw new IfLiveError("Another IF reservation has started or has an unsupported state; review the aircraft itinerary", "conflict", 409);
    }
    itinerary.push(leg(remote.originIcao, remote.destinationIcao, remote.scheduledDepartureUtc, remote.scheduledArrivalUtc, mapped.get(remote)?.public_id ?? null, remote.id, remote.status));
  }
  for (const flight of local) {
    if (found.has(flight.public_id.toLowerCase()) || flight.public_id.toLowerCase() === input.target?.publicId.toLowerCase()) continue;
    itinerary.push(leg(flight.departure, flight.arrival, flight.scheduled_departure, flight.scheduled_arrival, flight.public_id, null, null));
  }
  let target: IfItineraryLeg | undefined;
  if (input.target?.desired) {
    const desired = input.target.desired;
    target = leg(desired.originIcao, desired.destinationIcao, desired.scheduledDepartureUtc, desired.scheduledArrivalUtc, input.target.publicId, targetRemote?.id ?? null, targetRemote?.status ?? null);
    itinerary.push(target);
  }
  itinerary.sort((left, right) => left.departure - right.departure || left.arrival - right.arrival);
  const pendingRemovals = new Set([...mapped].filter(([remote, flight]) => remote !== targetRemote && flight.status && REMOVAL_STATUSES.has(flight.status)).map(([remote]) => remote.id));
  if (target && pendingRemovals.size) throw new IfLiveError("Remove the aircraft's pending owned IF reservations before publishing this amendment", "removal_pending", 409);
  // Removing the first planned leg must not silently strand a remaining foreign flight at its destination.
  const origin = input.target && !input.target.desired && targetRemote && !itinerary.some(row => row.departure < Date.parse(targetRemote.scheduledDepartureUtc))
    ? targetRemote.originIcao.toUpperCase() : null;
  const routeConflict = (rows: IfItineraryLeg[]) => {
    if (origin && rows.length && rows[0].origin !== origin) return new IfLiveError(`Removing this reservation would leave the aircraft at ${origin}, but the next flight departs from ${rows[0].origin}`, "conflict", 409);
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1]; const next = rows[index];
      if (next.departure < previous.arrival) return new IfLiveError("This flight overlaps another active IF or local reservation for the aircraft; review its bookings before publishing", "conflict", 409);
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
      const otherTime = Date.parse(other.scheduledDepartureUtc);
      if ((otherTime > target.departure && index < targetIndex) || (otherTime < target.departure && index > targetIndex)) {
        throw new IfLiveError("The IF queue places this flight on the wrong side of an external or active reservation; reconcile that queue before publishing", "conflict", 409);
      }
    }
  }
  return itinerary;
}
