import { requestInfiniteFlight } from "./infinite-flight/client";
import {
  findInfiniteFlightUser,
  isInfiniteFlightId,
  normalizeInfiniteFlightId,
  requireInfiniteFlightId,
} from "./infinite-flight/identifiers";
import type {
  InfiniteFlightAircraft,
  InfiniteFlightLivery,
  UnknownRecord,
} from "./infinite-flight/types";
import { InfiniteFlightApiError } from "./infinite-flight/types";

export {
  findInfiniteFlightUser,
  isInfiniteFlightId,
  normalizeInfiniteFlightId,
};
export { InfiniteFlightApiError };
export type {
  InfiniteFlightAircraft,
  InfiniteFlightCacheStatus,
  InfiniteFlightEnvelope,
  InfiniteFlightLivery,
  InfiniteFlightResult,
} from "./infinite-flight/types";

export const INFINITE_FLIGHT_CACHE_TTL = {
  aircraft: 60 * 60,
  user: 5 * 60,
  sessions: 10 * 60,
  flights: 15,
  flightPlan: 15,
} as const;

export function getInfiniteFlightAircraft() {
  return requestInfiniteFlight<InfiniteFlightAircraft[]>({
    path: "/aircraft",
    cacheKey: "if-aircraft-list",
    ttlSeconds: INFINITE_FLIGHT_CACHE_TTL.aircraft,
    isValidResult: Array.isArray,
  });
}

export async function getInfiniteFlightAircraftLiveries(aircraftId: unknown) {
  const id = requireInfiniteFlightId(aircraftId, "Aircraft ID");
  const response = await getInfiniteFlightLiveries();
  return {
    ...response,
    data: {
      ...response.data,
      result: response.data.result.filter(
        (livery) =>
          normalizeInfiniteFlightId(livery.aircraftID ?? livery.aircraftId) ===
          id,
      ),
    },
  };
}

export function getInfiniteFlightLiveries() {
  return requestInfiniteFlight<InfiniteFlightLivery[]>({
    path: "/aircraft/liveries",
    cacheKey: "if-aircraft-liveries-all",
    ttlSeconds: INFINITE_FLIGHT_CACHE_TTL.aircraft,
    isValidResult: Array.isArray,
  });
}

export function getInfiniteFlightUser(username: unknown) {
  const normalizedUsername =
    typeof username === "string"
      ? username.trim().toLocaleLowerCase("en-US")
      : "";

  if (!normalizedUsername || normalizedUsername.length > 120) {
    throw new InfiniteFlightApiError("IFC username is invalid", 400);
  }

  return requestInfiniteFlight<UnknownRecord[]>({
    path: "/users",
    method: "POST",
    body: { discourseNames: [normalizedUsername] },
    cacheKey: `if-user-${normalizedUsername}`,
    ttlSeconds: INFINITE_FLIGHT_CACHE_TTL.user,
    isValidResult: Array.isArray,
  });
}

export function getInfiniteFlightSessions() {
  return requestInfiniteFlight<UnknownRecord[]>({
    path: "/sessions",
    cacheKey: "if-sessions",
    ttlSeconds: INFINITE_FLIGHT_CACHE_TTL.sessions,
    isValidResult: Array.isArray,
  });
}

export function getInfiniteFlightFlights(sessionId: unknown) {
  const id = requireInfiniteFlightId(sessionId, "Session ID");
  return requestInfiniteFlight<UnknownRecord[]>({
    path: `/sessions/${encodeURIComponent(id)}/flights`,
    cacheKey: `if-session-flights-${id}`,
    ttlSeconds: INFINITE_FLIGHT_CACHE_TTL.flights,
    isValidResult: Array.isArray,
  });
}

export function getInfiniteFlightFlightPlan(
  sessionId: unknown,
  flightId: unknown,
) {
  const normalizedSessionId = requireInfiniteFlightId(sessionId, "Session ID");
  const normalizedFlightId = requireInfiniteFlightId(flightId, "Flight ID");

  return requestInfiniteFlight<UnknownRecord>({
    path: `/sessions/${encodeURIComponent(normalizedSessionId)}/flights/${encodeURIComponent(normalizedFlightId)}/flightplan`,
    cacheKey: `if-flight-plan-${normalizedSessionId}-${normalizedFlightId}`,
    ttlSeconds: INFINITE_FLIGHT_CACHE_TTL.flightPlan,
    isValidResult: (result: unknown): result is UnknownRecord =>
      Boolean(result) && typeof result === "object" && !Array.isArray(result),
  });
}
