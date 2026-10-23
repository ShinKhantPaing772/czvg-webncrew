"use client";

import { getToken } from "@/lib/utils/auth";

type CacheEntry = {
  status: number;
  statusText: string;
  headers: [string, string][];
  bodyText: string;
  timestamp: number;
};

const GET_CACHE_TTL_MS = 15_000;
const responseCache = new Map<string, CacheEntry>();
const inflightGetRequests = new Map<string, Promise<CacheEntry>>();

export function clearApiCache() {
  responseCache.clear();
  inflightGetRequests.clear();
}

export function authHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const token = getToken();

  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return nextHeaders;
}

function toResponse(entry: CacheEntry): Response {
  return new Response(entry.bodyText, {
    status: entry.status,
    statusText: entry.statusText,
    headers: entry.headers,
  });
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method || "GET").toUpperCase();
  const isTestEnv =
    typeof process !== "undefined" && process.env.NODE_ENV === "test";

  // Invalidate cached GET responses after any mutation
  if (method !== "GET" && method !== "HEAD") {
    responseCache.clear();
  }

  const urlKey =
    typeof input === "string"
      ? typeof window !== "undefined" &&
        input.startsWith(window.location.origin)
        ? input.slice(window.location.origin.length) || "/"
        : input
      : input instanceof URL
        ? typeof window !== "undefined" &&
          input.origin === window.location.origin
          ? `${input.pathname}${input.search}`
          : input.toString()
        : null;

  if (!isTestEnv && method === "GET" && urlKey && !init?.signal) {
    const cached = responseCache.get(urlKey);
    if (cached && Date.now() - cached.timestamp < GET_CACHE_TTL_MS) {
      return toResponse(cached);
    }

    const existingInflight = inflightGetRequests.get(urlKey);
    if (existingInflight) {
      return toResponse(await existingInflight);
    }

    const requestPromise = fetch(input, {
      ...init,
      headers: authHeaders(init?.headers),
    })
      .then(async (response) => {
        const bodyText = await response.text();
        const entry: CacheEntry = {
          status: response.status,
          statusText: response.statusText,
          headers: Array.from(response.headers.entries()),
          bodyText,
          timestamp: Date.now(),
        };
        if (response.ok) {
          responseCache.set(urlKey, entry);
        }
        return entry;
      })
      .finally(() => {
        inflightGetRequests.delete(urlKey);
      });

    inflightGetRequests.set(urlKey, requestPromise);
    return toResponse(await requestPromise);
  }

  return fetch(input, {
    ...init,
    headers: authHeaders(init?.headers),
  });
}
