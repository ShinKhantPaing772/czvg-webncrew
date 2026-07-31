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

export async function findCurrentFlight(ifUserId: string) {
  const { data: sessionsData } = await getInfiniteFlightSessions();
  const sessions = getArray(sessionsData);

  for (const session of sessions) {
    const sessionId = getString(session, ["id", "sessionId"]);
    if (!isInfiniteFlightId(sessionId)) continue;

    const { data: flightsData } = await getInfiniteFlightFlights(sessionId);
    const flight = getArray(flightsData).find(
      (item) =>
        getString(item, ["userId", "pilotId", "id"]).toLowerCase() ===
        ifUserId.toLowerCase(),
    );

    if (flight) return { sessionId, flight };
  }

  return null;
}

export async function findInfiniteFlightInUserLogbook(
  ifUserId: string,
  flightId: string,
) {
  const { data } = await getInfiniteFlightUserFlights(ifUserId);
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

  const totalTime = flight.totalTime;
  const calculatedEnd =
    typeof totalTime === "number" &&
    Number.isFinite(totalTime) &&
    totalTime > 0
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
  const activityTimestamp = flightActivityTimestamp(flight);

  return (
    activityTimestamp !== null &&
    activityTimestamp <= now + 5 * 60 * 1000 &&
    now - activityTimestamp <= RECENT_COMPLETED_FLIGHT_MAX_AGE_MS
  );
}

export async function findRecentCompletedInfiniteFlight(ifUserId: string) {
  const { data } = await getInfiniteFlightUserFlights(ifUserId);
  const now = Date.now();

  const flights = getArray(data)
    .filter((flight) => {
      const flightId = getString(flight, ["id", "flightId"]);
      const userId = getString(flight, ["userId"]);
      const totalTime = flight.totalTime;
      const fuelUsedKg = flight.fuelUsedKg;
      const landingCount = Number(flight.landingCount);

      return (
        isInfiniteFlightId(flightId) &&
        (!userId || userId.toLowerCase() === ifUserId.toLowerCase()) &&
        typeof totalTime === "number" &&
        Number.isFinite(totalTime) &&
        totalTime > 0 &&
        typeof fuelUsedKg === "number" &&
        Number.isFinite(fuelUsedKg) &&
        fuelUsedKg >= 0 &&
        Number.isFinite(landingCount) &&
        landingCount > 0 &&
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
