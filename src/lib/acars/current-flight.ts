import {
  findInfiniteFlightUser,
  getInfiniteFlightFlights,
  getInfiniteFlightSessions,
  getInfiniteFlightUser,
  getInfiniteFlightUserFlights,
  isInfiniteFlightId,
  normalizeInfiniteFlightId,
} from "../infinite-flight-api";
import { models } from "../models";
import {
  getArray,
  getString,
  parseInfiniteFlightDate,
  type UnknownRecord,
} from "./infinite-flight-data";

const ZERO_INFINITE_FLIGHT_ID = "00000000-0000-0000-0000-000000000000";
const RECENT_COMPLETED_FLIGHT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export async function findLocalAircraft(
  aircraftId: string,
  liveryId: string,
) {
  const normalizedAircraftId = normalizeInfiniteFlightId(aircraftId);
  const normalizedLiveryId = normalizeInfiniteFlightId(liveryId);
  const hasAircraftId =
    isInfiniteFlightId(normalizedAircraftId) &&
    normalizedAircraftId !== ZERO_INFINITE_FLIGHT_ID;
  const hasLiveryId =
    isInfiniteFlightId(normalizedLiveryId) &&
    normalizedLiveryId !== ZERO_INFINITE_FLIGHT_ID;

  if (!hasAircraftId && !hasLiveryId) return null;

  const aircraft = await models.Aircraft.findAll({
    attributes: ["id", "ifaircraftid", "ifliveryid"],
    where: { status: 1 },
    raw: true,
  });
  const aircraftRecords = aircraft as unknown as UnknownRecord[];

  if (hasAircraftId && hasLiveryId) {
    return (
      aircraftRecords.find(
        (item) =>
          normalizeInfiniteFlightId(getString(item, ["ifaircraftid"])) ===
            normalizedAircraftId &&
          normalizeInfiniteFlightId(getString(item, ["ifliveryid"])) ===
            normalizedLiveryId,
      ) ?? null
    );
  }

  if (hasLiveryId) {
    const liveryMatches = aircraftRecords.filter(
      (item) =>
        normalizeInfiniteFlightId(getString(item, ["ifliveryid"])) ===
        normalizedLiveryId,
    );

    return liveryMatches.length === 1 ? liveryMatches[0] : null;
  }

  if (!hasAircraftId) return null;

  return (
    aircraftRecords.find(
      (item) =>
        normalizeInfiniteFlightId(getString(item, ["ifaircraftid"])) ===
        normalizedAircraftId,
    ) ?? null
  );
}

export async function resolveInfiniteFlightUserId(pilot: UnknownRecord) {
  const storedUserId = getString(pilot, ["ifuserid"]);
  if (storedUserId) return storedUserId;

  const ifc = getString(pilot, ["ifc"]);
  if (!ifc) return "";

  const { data } = await getInfiniteFlightUser(ifc);
  const user = findInfiniteFlightUser(data.result, ifc);
  const userId = getString(user ?? {}, ["userId"]);

  if (userId) {
    await models.Pilot.update(
      { ifuserid: userId },
      { where: { id: pilot.id } },
    );
  }

  return userId;
}

export async function findCurrentFlight(
  ifUserId: string,
  forceRefresh = false,
) {
  const { data: sessionsData } = await getInfiniteFlightSessions(forceRefresh);
  const sessions = getArray(sessionsData);

  const sessionIds = sessions
    .map((session) => getString(session, ["id", "sessionId"]))
    .filter(isInfiniteFlightId);

  if (sessionIds.length === 0) return null;

  const results = await Promise.allSettled(
    sessionIds.map(async (sessionId) => {
      const { data: flightsData } = await getInfiniteFlightFlights(
        sessionId,
        forceRefresh,
      );
      const flight = getArray(flightsData).find(
        (item) =>
          getString(item, ["userId", "pilotId", "id"]).toLowerCase() ===
          ifUserId.toLowerCase(),
      );

      return flight ? { sessionId, flight } : null;
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      return result.value;
    }
  }

  return null;
}

export async function findInfiniteFlightInUserLogbook(
  ifUserId: string,
  flightId: string,
  forceRefresh = false,
) {
  const { data } = await getInfiniteFlightUserFlights(ifUserId, forceRefresh);
  const normalizedFlightId = normalizeInfiniteFlightId(flightId);

  return (
    getArray(data).find((flight) => {
      const candidateFlightId = normalizeInfiniteFlightId(
        getString(flight, ["id", "flightId"]),
      );
      const candidateUserId = getString(flight, ["userId"]);

      return (
        candidateFlightId === normalizedFlightId &&
        (!candidateUserId ||
          candidateUserId.toLowerCase() === ifUserId.toLowerCase())
      );
    }) ?? null
  );
}

function flightActivityTimestamp(flight: UnknownRecord) {
  const created = parseInfiniteFlightDate(flight.created)?.getTime();
  if (!Number.isFinite(created)) return null;

  const totalTime = Number(flight.totalTime);
  const calculatedEnd =
    Number.isFinite(totalTime) && totalTime > 0
      ? (created as number) + totalTime * 60 * 1000
      : (created as number);
  const latestLanding = getArray(flight.landingStats)
    .map((landing) =>
      parseInfiniteFlightDate(landing.timestamp)?.getTime(),
    )
    .filter((timestamp): timestamp is number => Number.isFinite(timestamp))
    .sort((left, right) => right - left)[0];

  return Math.max(calculatedEnd, latestLanding ?? calculatedEnd);
}

export function isRecentInfiniteFlight(
  flight: UnknownRecord,
  now = Date.now(),
) {
  const created = parseInfiniteFlightDate(flight.created)?.getTime();
  if (!Number.isFinite(created)) return false;

  const activityTimestamp =
    flightActivityTimestamp(flight) ?? (created as number);

  // Flight creation should not be in the future (allowing for 15 minutes clock skew)
  if ((created as number) > now + 15 * 60 * 1000) {
    return false;
  }

  // Activity should be within the recent window (24 hours)
  return now - activityTimestamp <= RECENT_COMPLETED_FLIGHT_MAX_AGE_MS;
}

export async function findRecentCompletedInfiniteFlight(
  ifUserId: string,
  forceRefresh = false,
) {
  const { data } = await getInfiniteFlightUserFlights(ifUserId, forceRefresh);
  const now = Date.now();

  const flights = getArray(data)
    .filter((flight) => {
      const flightId = getString(flight, ["id", "flightId"]);
      const userId = getString(flight, ["userId"]);
      const totalTime = Number(flight.totalTime);

      return (
        isInfiniteFlightId(flightId) &&
        (!userId || userId.toLowerCase() === ifUserId.toLowerCase()) &&
        (Number.isFinite(totalTime) ? totalTime > 0 : true) &&
        isRecentInfiniteFlight(flight, now)
      );
    })
    .sort(
      (left, right) =>
        (flightActivityTimestamp(right) ?? 0) -
        (flightActivityTimestamp(left) ?? 0),
    );

  return flights[0] ?? null;
}
