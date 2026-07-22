import {
  findInfiniteFlightUser,
  getInfiniteFlightFlights,
  getInfiniteFlightSessions,
  getInfiniteFlightUser,
  isInfiniteFlightId,
  normalizeInfiniteFlightId,
} from "../infinite-flight-api";
import { models } from "../models";
import {
  getArray,
  getString,
  type UnknownRecord,
} from "./infinite-flight-data";

export async function findLocalAircraft(
  aircraftId: string,
  liveryId: string,
) {
  const normalizedAircraftId = normalizeInfiniteFlightId(aircraftId);
  const normalizedLiveryId = normalizeInfiniteFlightId(liveryId);
  if (!isInfiniteFlightId(normalizedAircraftId)) return null;
  if (normalizedLiveryId && !isInfiniteFlightId(normalizedLiveryId)) return null;

  const aircraft = await models.Aircraft.findAll({
    attributes: ["id", "ifaircraftid", "ifliveryid"],
    where: { status: 1 },
    raw: true,
  });
  const aircraftRecords = aircraft as unknown as UnknownRecord[];
  const exactAircraftAndLivery = aircraftRecords.find(
    (item) =>
      normalizeInfiniteFlightId(getString(item, ["ifaircraftid"])) ===
        normalizedAircraftId &&
      normalizeInfiniteFlightId(getString(item, ["ifliveryid"])) ===
        normalizedLiveryId,
  );

  if (normalizedLiveryId) return exactAircraftAndLivery ?? null;

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
