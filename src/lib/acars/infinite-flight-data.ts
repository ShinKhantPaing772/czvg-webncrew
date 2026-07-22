export type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

export function getArray(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is UnknownRecord => Boolean(item) && typeof item === "object",
    );
  }

  const record = asRecord(value);
  const result = record.result;

  if (Array.isArray(result)) {
    return result.filter(
      (item): item is UnknownRecord => Boolean(item) && typeof item === "object",
    );
  }

  if (result && typeof result === "object") {
    const resultRecord = result as UnknownRecord;
    const nestedArrays = ["flights", "sessions", "items", "data"];
    for (const key of nestedArrays) {
      if (Array.isArray(resultRecord[key])) {
        return (resultRecord[key] as unknown[]).filter(
          (item): item is UnknownRecord =>
            Boolean(item) && typeof item === "object",
        );
      }
    }
  }

  return [];
}

export function getString(record: UnknownRecord, keys: string[]): string {
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

export function getNestedString(
  record: UnknownRecord,
  paths: string[],
): string {
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

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;

  return Math.max(0, (Date.now() - timestamp) / 1000);
}

export function extractFlightTime(flight: UnknownRecord) {
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

export function extractAirportFromRecord(
  record: UnknownRecord,
  keys: string[],
) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string") {
      const normalized = normalizeIcao(value);
      if (normalized.length === 4) return normalized;
    }

    const nestedIcao = getString(asRecord(value), [
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

export function extractAirportFromFlightPlan(
  plan: UnknownRecord,
  index: 0 | -1,
) {
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
