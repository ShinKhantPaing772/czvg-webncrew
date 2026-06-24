"use client";

import { getToken } from "@/lib/utils/auth";

export function authHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const token = getToken();

  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return nextHeaders;
}

export function authFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    headers: authHeaders(init?.headers),
  });
}
