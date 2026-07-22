import { deleteCached, getCached, setCached } from "../utils/if-cache";
import {
  InfiniteFlightApiError,
  type InfiniteFlightEnvelope,
  type InfiniteFlightResult,
  type RequestOptions,
} from "./types";

const API_BASE_URL = "https://api.infiniteflight.com/public/v2";
const REQUEST_TIMEOUT_MS = 20_000;
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

  const record = value as Record<string, unknown>;
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

export async function requestInfiniteFlight<T>(
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
    } catch {
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
        } catch {
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
    } catch {
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
    } catch {
      throw new InfiniteFlightApiError("Infinite Flight returned invalid JSON");
    }

    const data = parseValidatedEnvelope<T>(payload, options.isValidResult);
    if (isCacheableApiResponse(data)) {
      try {
        await setCached(options.cacheKey, data, options.ttlSeconds);
      } catch {
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
