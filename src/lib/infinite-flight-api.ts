import { deleteCached, getCached, setCached } from "@/lib/utils/if-cache";

const API_BASE_URL = "https://api.infiniteflight.com/public/v2";
const REQUEST_TIMEOUT_MS = 20_000;

export const INFINITE_FLIGHT_CACHE_TTL = {
  aircraft: 60 * 60,
  user: 5 * 60,
  sessions: 10 * 60,
  flights: 15,
  flightPlan: 15,
} as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type InfiniteFlightEnvelope<T> = {
  errorCode: number;
  result: T;
};

export type InfiniteFlightCacheStatus = "HIT" | "MISS";

export type InfiniteFlightResult<T> = {
  data: InfiniteFlightEnvelope<T>;
  cacheStatus: InfiniteFlightCacheStatus;
};

export type InfiniteFlightAircraft = {
  id: string;
  name: string;
};

export type InfiniteFlightLivery = {
  id: string;
  aircraftID?: string;
  aircraftId?: string;
  aircraftName: string;
  liveryName: string;
};

type UnknownRecord = Record<string, unknown>;

type RequestOptions<T> = {
  path: string;
  cacheKey: string;
  ttlSeconds: number;
  method?: "GET" | "POST";
  body?: UnknownRecord;
  isValidResult: (value: unknown) => value is T;
};

export class InfiniteFlightApiError extends Error {
  readonly status: number;
  readonly apiErrorCode: number | null;

  constructor(message: string, status = 502, apiErrorCode: number | null = null) {
    super(message);
    this.name = "InfiniteFlightApiError";
    this.status = status;
    this.apiErrorCode = apiErrorCode;
  }
}

const pendingRequests = new Map<
  string,
  Promise<InfiniteFlightResult<unknown>>
>();

function parseEnvelope<T>(value: unknown): InfiniteFlightEnvelope<T> {
  if (!value || typeof value !== "object") {
    throw new InfiniteFlightApiError(
      "Infinite Flight returned an invalid response",
    );
  }

  const record = value as UnknownRecord;
  const errorCode = record.errorCode;
  if (
    typeof errorCode !== "number" ||
    !Number.isInteger(errorCode) ||
    !("result" in record)
  ) {
    throw new InfiniteFlightApiError(
      "Infinite Flight returned an invalid response",
    );
  }

  return { errorCode, result: record.result as T };
}

function parseValidatedEnvelope<T>(
  value: unknown,
  isValidResult: (result: unknown) => result is T,
) {
  const data = parseEnvelope<T>(value);
  if (data.errorCode === 0 && !isValidResult(data.result)) {
    throw new InfiniteFlightApiError(
      "Infinite Flight returned an invalid result",
    );
  }
  return data;
}

function throwForApiError(data: InfiniteFlightEnvelope<unknown>) {
  if (data.errorCode === 0) return;

  const status =
    data.errorCode === 1 || data.errorCode === 5 || data.errorCode === 6
      ? 404
      : 502;
  throw new InfiniteFlightApiError(
    `Infinite Flight returned error code ${data.errorCode}`,
    status,
    data.errorCode,
  );
}

function isCacheableApiResponse(data: InfiniteFlightEnvelope<unknown>) {
  return data.errorCode === 0 || [1, 5, 6].includes(data.errorCode);
}

function upstreamHttpStatus(status: number) {
  if (status === 429) return 429;
  if (status >= 400 && status < 500) return status;
  return 502;
}

async function requestInfiniteFlight<T>(
  options: RequestOptions<T>,
): Promise<InfiniteFlightResult<T>> {
  const existingRequest = pendingRequests.get(options.cacheKey);
  if (existingRequest) {
    return existingRequest as Promise<InfiniteFlightResult<T>>;
  }

  const request = (async (): Promise<InfiniteFlightResult<T>> => {
    let cached: unknown | null;
    try {
      cached = await getCached<unknown>(options.cacheKey);
    } catch (error) {
      throw new InfiniteFlightApiError(
        "Infinite Flight database cache is unavailable",
        503,
      );
    }

    if (cached !== null) {
      let data: InfiniteFlightEnvelope<T> | null = null;
      try {
        data = parseValidatedEnvelope<T>(cached, options.isValidResult);
      } catch (error) {
        try {
          await deleteCached(options.cacheKey);
        } catch (cacheError) {
          throw new InfiniteFlightApiError(
            "Infinite Flight database cache is unavailable",
            503,
          );
        }
        console.warn("[Infinite Flight] Discarded an invalid cached response", {
          cacheKey: options.cacheKey,
          error,
        });
      }

      if (data) {
        throwForApiError(data);
        return { data, cacheStatus: "HIT" };
      }
    }

    const apiKey = process.env.IF_API?.trim();
    if (!apiKey) {
      throw new InfiniteFlightApiError(
        "Infinite Flight API key is not configured",
        500,
      );
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${options.path}`, {
        method: options.method ?? "GET",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new InfiniteFlightApiError(
        "Infinite Flight API is unavailable",
        502,
        null,
      );
    }

    if (!response.ok) {
      throw new InfiniteFlightApiError(
        `Infinite Flight API returned HTTP ${response.status}`,
        upstreamHttpStatus(response.status),
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new InfiniteFlightApiError(
        "Infinite Flight returned invalid JSON",
      );
    }

    const data = parseValidatedEnvelope<T>(payload, options.isValidResult);
    if (isCacheableApiResponse(data)) {
      try {
        await setCached(options.cacheKey, data, options.ttlSeconds);
      } catch (error) {
        throw new InfiniteFlightApiError(
          "Infinite Flight database cache is unavailable",
          503,
        );
      }
    }
    throwForApiError(data);
    return { data, cacheStatus: "MISS" };
  })();

  pendingRequests.set(
    options.cacheKey,
    request as Promise<InfiniteFlightResult<unknown>>,
  );

  try {
    return await request;
  } finally {
    pendingRequests.delete(options.cacheKey);
  }
}

export function normalizeInfiniteFlightId(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isInfiniteFlightId(value: unknown) {
  return UUID_PATTERN.test(normalizeInfiniteFlightId(value));
}

export function findInfiniteFlightUser(users: unknown, username: unknown) {
  if (!Array.isArray(users) || typeof username !== "string") return null;
  const normalizedUsername = username.trim().toLocaleLowerCase("en-US");
  if (!normalizedUsername) return null;

  return (
    users.find((item): item is UnknownRecord => {
      if (!item || typeof item !== "object") return false;
      const record = item as UnknownRecord;
      const discourseUsername =
        typeof record.discourseUsername === "string"
          ? record.discourseUsername.trim().toLocaleLowerCase("en-US")
          : "";
      const perUserErrorCode = Number(record.errorCode ?? 0);

      return (
        discourseUsername === normalizedUsername &&
        perUserErrorCode === 0 &&
        isInfiniteFlightId(record.userId)
      );
    }) ?? null
  );
}

function requireInfiniteFlightId(value: unknown, label: string) {
  const id = normalizeInfiniteFlightId(value);
  if (!isInfiniteFlightId(id)) {
    throw new InfiniteFlightApiError(`${label} must be a valid UUID`, 400);
  }
  return id;
}

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
