import { IfLiveError } from "./config";
import { assertIfItinerary, orderedIfSchedules, type IfLocalFlight } from "./itinerary";
import { sameIfCrew, sameIfSchedule, scheduleMarker } from "./sync";
import type { AuthoredIfPayload, IfPosition, IfSchedule } from "./types";

// A vicinity check catches another airport without claiming to identify a runway or stand.
export const IF_DEPARTURE_RADIUS_NM = 5;
export const IF_START_CHECK_MAX_AGE_MS = 30_000;

function distanceNm(left: { latitude: number; longitude: number }, right: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitude = radians(right.latitude - left.latitude);
  const longitude = radians(right.longitude - left.longitude);
  const value = Math.sin(latitude / 2) ** 2 + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude)) * Math.sin(longitude / 2) ** 2;
  return 3440.065 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, value))));
}

/** Fresh IF responses are inspected in memory only; local arrival confirmation remains authoritative. */
export function assertIfDepartureReady(input: {
  publicId: string; remoteId: string | null; aircraftId: string; organizationId: string;
  desired: AuthoredIfPayload; schedules: IfSchedule[]; position: IfPosition;
  airport: { icao: string; latitude: number; longitude: number }; localFlights: IfLocalFlight[];
}) {
  const marker = scheduleMarker(input.publicId);
  const marked = input.schedules.filter(row => row.briefing?.includes(marker));
  if (marked.length !== 1 || !input.remoteId || marked[0].id.toLowerCase() !== input.remoteId.toLowerCase()) {
    throw new IfLiveError("The published IF reservation is missing or its reference changed; ask an administrator to reconcile it before departure", "conflict", 409);
  }
  const target = marked[0];
  if (input.schedules.some(row => row.aircraftId?.toLowerCase() !== input.aircraftId.toLowerCase() || row.organizationId?.toLowerCase() !== input.organizationId.toLowerCase())) {
    throw new IfLiveError("IF returned reservations for a different aircraft or organization; review the binding", "binding", 409);
  }
  if (target.status !== 1) throw new IfLiveError("This IF reservation is no longer scheduled; review its current state before departure. Start locally before departing in IF", "conflict", 409);
  let unchanged = false;
  try { unchanged = sameIfSchedule(target, input.desired.schedule) && sameIfCrew(target.crew, input.desired.crew); } catch { /* Unsupported upstream values fail closed. */ }
  if (!unchanged) throw new IfLiveError("The IF schedule or crew changed after publication; ask an administrator to reconcile it before departure", "conflict", 409);
  const active = orderedIfSchedules(input.schedules).filter(row => ![9, 11].includes(row.status));
  if (active[0]?.id !== target.id || active.some(row => row.id !== target.id && row.status !== 1)) {
    throw new IfLiveError("Finish or resolve the aircraft's preceding IF reservation before starting this flight", "conflict", 409);
  }
  assertIfItinerary({ schedules: input.schedules, localFlights: input.localFlights, target: { publicId: input.publicId, desired: input.desired.schedule }, requireUnstartedReservations: true });
  const position = input.position;
  if (position.id.toLowerCase() !== input.aircraftId.toLowerCase() || position.state !== 1 || position.isOnGround !== true) {
    throw new IfLiveError("The IF aircraft must be on the ground and available before departure", "conflict", 409);
  }
  if (input.airport.icao.toUpperCase() !== input.desired.schedule.originIcao.toUpperCase() ||
      ![position.latitude, position.longitude, input.airport.latitude, input.airport.longitude].every(Number.isFinite) ||
      Math.abs(position.latitude) > 90 || Math.abs(input.airport.latitude) > 90 || Math.abs(position.longitude) > 180 || Math.abs(input.airport.longitude) > 180) {
    throw new IfLiveError("The IF aircraft or departure airport position could not be verified", "invalid_response", 502);
  }
  if (distanceNm(position, input.airport) > IF_DEPARTURE_RADIUS_NM) {
    throw new IfLiveError(`The IF aircraft is outside the ${IF_DEPARTURE_RADIUS_NM} nautical mile vicinity of ${input.desired.schedule.originIcao}; confirm its actual airport and repair the flight queue`, "conflict", 409);
  }
}
