import { IfLiveError, isIfUuid } from "./config";
import type { AuthoredIfPayload, IfCrew, IfSchedule, IfScheduleRequest } from "./types";

export type PublishAction = "sync" | "overwrite" | "recreate";
export type PublishedPayload = AuthoredIfPayload & { crewPending?: boolean; previousCrew?: IfCrew[] };
export type SyncApi = {
  create(body: IfScheduleRequest): Promise<IfSchedule>;
  update(id: string, body: IfScheduleRequest): Promise<IfSchedule>;
  remove(id: string): Promise<void>;
  putCrew(id: string, crew: IfCrew): Promise<IfSchedule>;
  removeCrew(id: string, userId: string): Promise<IfSchedule>;
};

export function scheduleMarker(publicId: string) {
  if (!isIfUuid(publicId)) throw new IfLiveError("Local schedule marker is invalid", "validation", 400);
  return `[WNC schedule:${publicId.toLowerCase()}]`;
}

export function buildIfPayload(
  flight: { id: number; public_id: string; callsign: string | null; departure: string; arrival: string; scheduled_departure: Date; scheduled_arrival: Date; notes: string | null },
  crew: IfCrew[],
): AuthoredIfPayload {
  if (!crew.length || crew.length > 3 || crew.filter(row => row.role === 0).length !== 1 ||
      !crew.every(row => isIfUuid(row.userId)) || new Set(crew.map(row => row.userId.toLowerCase())).size !== crew.length) {
    throw new IfLiveError("IF publishing requires one captain and at most two additional crew with distinct IF user IDs", "crew", 409);
  }
  const callsign = flight.callsign?.trim() || `WNC${flight.id}`;
  const departure = flight.scheduled_departure.toISOString(); const arrival = flight.scheduled_arrival.toISOString();
  if (!callsign || callsign.length > 32 || /[\u0000-\u001f\u007f]/.test(callsign) || !/^[A-Z0-9]{1,8}$/.test(flight.departure) || !/^[A-Z0-9]{1,8}$/.test(flight.arrival) || arrival <= departure) {
    throw new IfLiveError("The local flight cannot be represented as an IF schedule", "validation", 409);
  }
  const notes = (flight.notes ?? "").replace(/\[WNC schedule:[0-9a-f-]+\]/gi, "").trim();
  const briefing = [notes, scheduleMarker(flight.public_id)].filter(Boolean).join("\n\n");
  if (briefing.length > 4000) throw new IfLiveError("Flight notes plus the IF schedule reference exceed 4000 characters", "validation", 409);
  return { schedule: { callsign, flightType: 1, originIcao: flight.departure, destinationIcao: flight.arrival, scheduledDepartureUtc: departure, scheduledArrivalUtc: arrival, briefing, flightPlan: null }, crew: crew.map(row => ({ userId: row.userId.toLowerCase(), role: row.role })) };
}

function normalizedSchedule(schedule: IfScheduleRequest) {
  return { callsign: schedule.callsign, flightType: schedule.flightType, originIcao: schedule.originIcao.toUpperCase(), destinationIcao: schedule.destinationIcao.toUpperCase(),
    scheduledDepartureUtc: new Date(schedule.scheduledDepartureUtc).toISOString(), scheduledArrivalUtc: new Date(schedule.scheduledArrivalUtc).toISOString(),
    briefing: schedule.briefing || null, flightPlan: schedule.flightPlan || null };
}
function normalizedCrew(crew: IfCrew[]) { return crew.map(row => ({ userId: row.userId.toLowerCase(), role: row.role })).sort((a, b) => a.userId.localeCompare(b.userId)); }
export function sameIfSchedule(left: IfScheduleRequest, right: IfScheduleRequest) { return JSON.stringify(normalizedSchedule(left)) === JSON.stringify(normalizedSchedule(right)); }
export function sameIfCrew(left: IfCrew[], right: IfCrew[]) { return JSON.stringify(normalizedCrew(left)) === JSON.stringify(normalizedCrew(right)); }
function crewIsSubset(crew: IfCrew[], expected: IfCrew[]) { return crew.every(row => expected.some(wanted => wanted.userId.toLowerCase() === row.userId.toLowerCase() && wanted.role === row.role)); }

/** Pure reconciliation logic. checkpoint stores only the desired, app-authored payload. */
export async function synchronizeIfFlight(input: {
  publicId: string; remoteId: string | null; schedules: IfSchedule[]; desired: AuthoredIfPayload | null;
  previous: PublishedPayload | null; action: PublishAction; uncertainCreation: boolean;
  api: SyncApi; checkpoint(id: string, authored: PublishedPayload): Promise<void>;
}) {
  const marker = scheduleMarker(input.publicId);
  const marked = input.schedules.filter(row => typeof row.briefing === "string" && row.briefing.includes(marker));
  if (marked.length > 1) throw new IfLiveError("Multiple IF schedules have this local reference; resolve the duplicates in IF before retrying", "conflict", 409);
  let remote = marked[0] ?? null;
  const bound = input.remoteId ? input.schedules.find(row => row.id.toLowerCase() === input.remoteId!.toLowerCase()) : null;
  if (bound && bound !== remote) throw new IfLiveError("The linked IF schedule no longer has this app's reference; review the IF reservation", "conflict", 409);
  if (remote && input.remoteId && remote.id.toLowerCase() !== input.remoteId.toLowerCase() && input.action === "sync") throw new IfLiveError("The IF schedule identifier changed; review it before relinking", "conflict", 409);
  if (remote && remote.status !== 1) throw new IfLiveError("IF has already started or changed this reservation; it cannot be changed automatically", "conflict", 409);
  if (remote && input.action !== "overwrite") {
    const expected = input.previous ?? input.desired;
    if (!expected || !sameIfSchedule(remote, expected.schedule) ||
        !(input.previous?.crewPending || !input.previous ? crewIsSubset(remote.crew, [...expected.crew, ...(input.previous?.previousCrew ?? [])]) : sameIfCrew(remote.crew, expected.crew))) {
      throw new IfLiveError("The IF schedule or crew changed outside this app; review before overwriting", "conflict", 409);
    }
  }
  if (!input.desired) {
    if (!remote && input.uncertainCreation) throw new IfLiveError("An earlier IF create request was not confirmed; verify that no reservation remains before removing the binding", "reconciliation", 409);
    if (remote) await input.api.remove(remote.id);
    return { remoteId: null, removed: true as const };
  }
  const departure = Date.parse(input.desired.schedule.scheduledDepartureUtc);
  const arrival = Date.parse(input.desired.schedule.scheduledArrivalUtc);
  for (const other of input.schedules) {
    // Cancelled (9) and Arrived (11) are the documented terminal preview states.
    if (other.id === remote?.id || [9, 11].includes(other.status)) continue;
    const otherDeparture = Date.parse(other.scheduledDepartureUtc);
    const otherArrival = Date.parse(other.scheduledArrivalUtc);
    if (!Number.isFinite(otherDeparture) || !Number.isFinite(otherArrival) || otherArrival <= otherDeparture) {
      throw new IfLiveError("An active IF reservation has an invalid time interval; review IF before publishing", "conflict", 409);
    }
    if (departure < otherArrival && arrival > otherDeparture) {
      throw new IfLiveError("This flight overlaps another active IF reservation for the aircraft; review IF's bookings before publishing", "conflict", 409);
    }
  }
  const transitionalPayload: PublishedPayload = { ...input.desired, crewPending: true,
    previousCrew: normalizedCrew([...(input.previous?.crew ?? []), ...(input.previous?.previousCrew ?? [])]) };
  if (!remote) {
    if ((input.remoteId || input.uncertainCreation) && input.action !== "recreate") throw new IfLiveError("The IF reservation could not be found. Review IF, then explicitly recreate only if it is absent", "reconciliation", 409);
    remote = await input.api.create(input.desired.schedule);
    await input.checkpoint(remote.id, transitionalPayload);
  } else if (!sameIfSchedule(remote, input.desired.schedule)) {
    remote = await input.api.update(remote.id, input.desired.schedule);
    await input.checkpoint(remote.id, transitionalPayload);
  }
  // Persist a known schedule ID before crew calls, so a partial crew failure never repeats POST.
  await input.checkpoint(remote.id, transitionalPayload);
  for (const crew of remote.crew) {
    if (!input.desired.crew.some(row => row.userId.toLowerCase() === crew.userId.toLowerCase())) remote = await input.api.removeCrew(remote.id, crew.userId);
  }
  for (const crew of input.desired.crew) {
    if (!remote.crew.some(row => row.userId.toLowerCase() === crew.userId.toLowerCase() && row.role === crew.role)) remote = await input.api.putCrew(remote.id, crew);
  }
  return { remoteId: remote.id, removed: false as const };
}
