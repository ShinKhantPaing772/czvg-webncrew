import { NextRequest, NextResponse } from "next/server";
import { models } from "@/lib/models";
import { hasPermission, requireAuth } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function getArray(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is UnknownRecord => typeof item === "object",
    );
  }

  const record = asRecord(value);
  const result = record.result;

  if (Array.isArray(result)) {
    return result.filter(
      (item): item is UnknownRecord => typeof item === "object",
    );
  }

  if (result && typeof result === "object") {
    const resultRecord = result as UnknownRecord;
    const nestedArrays = ["flights", "sessions", "items", "data"];
    for (const key of nestedArrays) {
      if (Array.isArray(resultRecord[key])) {
        return (resultRecord[key] as unknown[]).filter(
          (item): item is UnknownRecord => typeof item === "object",
        );
      }
    }
  }

  return [];
}

function getString(record: UnknownRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }

  return "";
}

function getNestedString(record: UnknownRecord, paths: string[]): string {
  for (const path of paths) {
    const value = path
      .split(".")
      .reduce<unknown>((current, key) => asRecord(current)[key], record);

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }

  return "";
}

function normalizeIcao(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase();
}

function normalizeDurationSeconds(key: string, value: number) {
  const lowerKey = key.toLowerCase();

  if (lowerKey.includes("millisecond") || lowerKey.endsWith("ms")) {
    return value / 1000;
  }

  // Live APIs sometimes expose elapsed time in milliseconds without naming it.
  return value > 604800 ? value / 1000 : value;
}

function secondsToFlightTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

function dateToSeconds(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const parsed = new Date(value);
  const timestamp = parsed.getTime();

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.max(0, (Date.now() - timestamp) / 1000);
}

function extractFlightTime(flight: UnknownRecord) {
  const durationKeys = [
    "flightTime",
    "flightTimeSeconds",
    "flightTimeMilliseconds",
    "flightTimeMs",
    "totalFlightTime",
    "duration",
    "durationSeconds",
    "durationMilliseconds",
    "durationMs",
    "totalTime",
  ];

  for (const key of durationKeys) {
    const value = flight[key];
    if (typeof value === "number") {
      return secondsToFlightTime(normalizeDurationSeconds(key, value));
    }
  }

  const startedSeconds = [
    "created",
    "createdAt",
    "startTime",
    "startedAt",
    "departureTime",
  ]
    .map((key) => dateToSeconds(flight[key]))
    .find((value): value is number => value !== null);

  return startedSeconds ? secondsToFlightTime(startedSeconds) : "";
}

async function findLocalAircraft(aircraftId: string, liveryId: string) {
  if (!aircraftId) return null;

  const aircraft = await models.Aircraft.findAll({
    attributes: ["id", "ifaircraftid", "ifliveryid"],
    where: { status: 1 },
    raw: true,
  });
  const aircraftRecords = aircraft as unknown as UnknownRecord[];
  const exactAircraftAndLivery = aircraftRecords.find(
    (item) =>
      getString(item, ["ifaircraftid"]) === aircraftId &&
      getString(item, ["ifliveryid"]) === liveryId,
  );

  if (liveryId) return exactAircraftAndLivery ?? null;

  return (
    aircraftRecords.find(
      (item) => getString(item, ["ifaircraftid"]) === aircraftId,
    ) ?? null
  );
}

function extractAirportFromRecord(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string") {
      const normalized = normalizeIcao(value);
      if (normalized.length === 4) return normalized;
    }

    const nested = asRecord(value);
    const nestedIcao = getString(nested, [
      "icao",
      "icaoCode",
      "identifier",
      "airportIdentifier",
      "name",
    ]);

    if (nestedIcao) {
      const normalized = normalizeIcao(nestedIcao);
      if (normalized.length === 4) return normalized;
    }
  }

  return "";
}

function extractAirportFromFlightPlan(plan: UnknownRecord, index: 0 | -1) {
  const root = asRecord(plan.result ?? plan);
  const direct = extractAirportFromRecord(root, [
    index === 0 ? "originAirport" : "destinationAirport",
    index === 0 ? "departureAirport" : "arrivalAirport",
    index === 0 ? "departure" : "arrival",
    index === 0 ? "origin" : "destination",
  ]);

  if (direct) return direct;

  const items = getArray(root.flightPlanItems ?? root.waypoints ?? root.items);
  const item = index === 0 ? items[0] : items[items.length - 1];

  if (!item) return "";

  return extractAirportFromRecord(item, [
    "icao",
    "icaoCode",
    "identifier",
    "airportIdentifier",
    "name",
  ]);
}

async function fetchInfiniteFlight(path: string, init?: RequestInit) {
  const response = await fetch(
    `https://api.infiniteflight.com/public/v2${path}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.IF_API}`,
        ...(init?.headers ?? {}),
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Infinite Flight API returned ${response.status} for ${path}`,
    );
  }

  return response.json();
}

async function resolveInfiniteFlightUserId(pilot: UnknownRecord) {
  const storedUserId = getString(pilot, ["ifuserid"]);
  if (storedUserId) return storedUserId;

  const ifc = getString(pilot, ["ifc"]);
  if (!ifc) return "";

  const data = await fetchInfiniteFlight("/users", {
    method: "POST",
    body: JSON.stringify({ discourseNames: [ifc] }),
  });
  const users = getArray(data);
  const userId = getString(users[0] ?? {}, ["userId", "id"]);

  if (userId) {
    await models.Pilot.update(
      { ifuserid: userId },
      { where: { id: pilot.id } },
    );
  }

  return userId;
}

async function findCurrentFlight(ifUserId: string) {
  const sessionsData = await fetchInfiniteFlight("/sessions");
  const sessions = getArray(sessionsData);

  for (const session of sessions) {
    const sessionId = getString(session, ["id", "sessionId"]);
    if (!sessionId) continue;

    const flightsData = await fetchInfiniteFlight(
      `/sessions/${sessionId}/flights`,
    );
    const flights = getArray(flightsData);
    const flight = flights.find(
      (item) =>
        getString(item, ["userId", "pilotId", "id"]).toLowerCase() ===
        ifUserId.toLowerCase(),
    );

    if (flight) {
      return { sessionId, flight };
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const pilotId = request.nextUrl.searchParams.get("pilotId");

  if (!pilotId) {
    return NextResponse.json(
      { error: "Pilot ID is required" },
      { status: 400 },
    );
  }

  const canFetchPilot =
    String(auth.user.id) === String(pilotId) ||
    hasPermission(auth.user, ["pireps", "users"]);

  if (!canFetchPilot) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.IF_API) {
    return NextResponse.json(
      { error: "Infinite Flight API key is not configured" },
      { status: 500 },
    );
  }

  try {
    const pilot = await models.Pilot.findByPk(pilotId, {
      attributes: ["id", "ifc", "ifuserid"],
      raw: true,
    });

    if (!pilot) {
      return NextResponse.json({ error: "Pilot not found" }, { status: 404 });
    }

    const pilotRecord = pilot as unknown as UnknownRecord;
    const ifUserId = await resolveInfiniteFlightUserId(pilotRecord);
    if (!ifUserId) {
      return NextResponse.json(
        { error: "Infinite Flight user ID is not linked to this pilot" },
        { status: 400 },
      );
    }

    const currentFlight = await findCurrentFlight(ifUserId);
    if (!currentFlight) {
      return NextResponse.json(
        { error: "No active Infinite Flight flight found for this pilot" },
        { status: 404 },
      );
    }

    const { sessionId, flight } = currentFlight;
    const flightId = getString(flight, ["flightId", "id"]);
    let flightPlan: UnknownRecord = {};

    if (flightId) {
      try {
        flightPlan = await fetchInfiniteFlight(
          `/sessions/${sessionId}/flights/${flightId}/flightplan`,
        );
      } catch (error) {
        console.warn("[ACARS] Unable to fetch flight plan:", error);
      }
    }

    const aircraftId = getNestedString(flight, [
      "aircraftId",
      "aircraftID",
      "aircraft.id",
      "aircraft.aircraftId",
      "aircraft.aircraftID",
    ]);
    const liveryId = getNestedString(flight, [
      "liveryId",
      "liveryID",
      "livery.id",
      "livery.liveryId",
      "livery.liveryID",
    ]);
    const aircraft = await findLocalAircraft(aircraftId, liveryId);

    const departure =
      extractAirportFromRecord(flight, [
        "departure",
        "departureAirport",
        "origin",
        "originAirport",
      ]) || extractAirportFromFlightPlan(flightPlan, 0);
    const arrival =
      extractAirportFromRecord(flight, [
        "arrival",
        "arrivalAirport",
        "destination",
        "destinationAirport",
      ]) || extractAirportFromFlightPlan(flightPlan, -1);
    const fuelUsed = getString(flight, [
      "fuelUsed",
      "fuelUsedKg",
      "fuelBurned",
      "fuelBurnedKg",
    ]);

    return NextResponse.json({
      acars: {
        flightnum: getString(flight, [
          "flightNumber",
          "flightnum",
          "flightNum",
          "flightNo",
          "flight",
        ]),
        departure,
        arrival,
        flightTime: extractFlightTime(flight),
        date: new Date().toISOString().slice(0, 10),
        aircraftId: aircraft
          ? String((aircraft as unknown as UnknownRecord).id)
          : "",
        fuelUsed,
        multi: "",
      },
      meta: {
        sessionId,
        flightId,
        aircraftMatched: Boolean(aircraft),
      },
    });
  } catch (error) {
    console.error("[ACARS] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ACARS data from Infinite Flight" },
      { status: 500 },
    );
  }
}
