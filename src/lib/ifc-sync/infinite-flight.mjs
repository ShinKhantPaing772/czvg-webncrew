import {
  getCachedUserPayload,
  setCachedUserPayload,
} from "./cache.mjs";
import { normalized, stringValue } from "./values.mjs";

const IF_USERS_URL = "https://api.infiniteflight.com/public/v2/users";
const IF_BATCH_SIZE = 25;
const IF_REQUEST_INTERVAL_MS = 2_100;
const IF_REQUEST_TIMEOUT_MS = 20_000;
const IF_MAX_ATTEMPTS = 3;

let lastInfiniteFlightRequestAt = 0;

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryAfterMilliseconds(value) {
  if (!value) return 0;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

  const date = new Date(value).getTime();
  return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
}

async function throttleInfiniteFlightRequest() {
  const elapsed = Date.now() - lastInfiniteFlightRequestAt;
  const waitFor = Math.max(0, IF_REQUEST_INTERVAL_MS - elapsed);
  if (waitFor > 0) await sleep(waitFor);
  lastInfiniteFlightRequestAt = Date.now();
}

function parseInfiniteFlightUsers(payload) {
  if (typeof payload?.errorCode !== "number" || payload.errorCode !== 0) {
    throw new Error(
      `Infinite Flight user lookup returned error code ${String(payload?.errorCode)}`,
    );
  }

  if (!Array.isArray(payload.result)) {
    throw new Error("Infinite Flight user lookup returned an invalid result");
  }

  return payload.result
    .filter((user) => user && typeof user === "object")
    .map((user) => ({
      userId: stringValue(user.userId),
      discourseUsername: stringValue(user.discourseUsername),
      errorCode: Number(user.errorCode ?? 0),
    }))
    .filter((user) => user.userId && user.errorCode === 0);
}

async function fetchInfiniteFlightUsers(search, apiKey, connection) {
  const cachedPayload = await getCachedUserPayload(connection, search);
  if (cachedPayload !== null) {
    return parseInfiniteFlightUsers(cachedPayload);
  }

  for (let attempt = 1; attempt <= IF_MAX_ATTEMPTS; attempt += 1) {
    await throttleInfiniteFlightRequest();

    let response;
    try {
      response = await fetch(IF_USERS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(search),
        signal: AbortSignal.timeout(IF_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (attempt === IF_MAX_ATTEMPTS) throw error;
      await sleep(attempt * 1_000);
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      if (attempt === IF_MAX_ATTEMPTS) {
        throw new Error(
          `Infinite Flight user lookup failed with HTTP ${response.status}`,
        );
      }

      const retryAfter = retryAfterMilliseconds(
        response.headers.get("retry-after"),
      );
      await sleep(Math.max(retryAfter, attempt * 2_000));
      continue;
    }

    if (!response.ok) {
      throw new Error(
        `Infinite Flight user lookup failed with HTTP ${response.status}`,
      );
    }

    const payload = await response.json();
    const users = parseInfiniteFlightUsers(payload);
    await setCachedUserPayload(connection, search, payload);
    return users;
  }

  return [];
}

export async function fetchUsersInBatches(
  searchKey,
  values,
  apiKey,
  connection,
) {
  const users = [];
  const uniqueValues = [
    ...new Map(values.map((value) => [normalized(value), value])).values(),
  ];

  for (const valuesBatch of chunk(uniqueValues, IF_BATCH_SIZE)) {
    users.push(
      ...(await fetchInfiniteFlightUsers(
        { [searchKey]: valuesBatch },
        apiKey,
        connection,
      )),
    );
  }

  return users;
}
