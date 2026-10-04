"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/utils/api";
import type { LiveAircraft } from "./types";
import { errorMessage } from "./utils";

export type IfPositionView = {
  state: number;
  isOnGround: boolean;
  latitude: number;
  longitude: number;
  updatedAt: string;
};
export type AircraftPositionView = {
  id: number;
  position: IfPositionView | null;
  nearbyAirport: { icao: string; distanceNm: number } | null;
  error?: string;
  code?: string;
};
type PositionSnapshot = {
  aircraft: AircraftPositionView[];
  loadedAt: string;
  expiresAt: string;
  airportLookupError?: string;
};

/** Admin-requested snapshots remain in page memory, with an age warning; never local storage. */
export function useIfPositions(aircraft: LiveAircraft[], admin: boolean) {
  const [stored, setStored] = useState<{ data: PositionSnapshot; bindings: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const linked = (admin ? aircraft : []).filter(tail => tail.if_aircraft_id).sort((left, right) => left.id - right.id);
  const aircraftIds = linked.map(tail => tail.id).join(",");
  const bindings = linked.map(tail => `${tail.id}:${tail.aircraft_id}:${tail.if_aircraft_id}`).join("|");
  const snapshot = stored?.bindings === bindings ? stored.data : null;

  const cancel = useCallback(() => {
    mounted.current = false; ++requestId.current; controller.current?.abort();
  }, []);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    controller.current?.abort();
    setError("");
    if (!aircraftIds) { setLoading(false); return; }
    const next = new AbortController(); controller.current = next; setLoading(true);
    const timeout = window.setTimeout(() => next.abort(), 25000);
    try {
      const response = await authFetch(`/api/admin/scheduling/if/positions?aircraftIds=${encodeURIComponent(aircraftIds)}`, { cache: "no-store", signal: next.signal });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success === false) {
        if (mounted.current && id === requestId.current && ([401, 403].includes(response.status) || ["binding", "connection_changed", "reauth_required", "not_connected", "access_suspended"].includes(result?.code))) setStored(null);
        throw new Error(typeof result?.error === "string" ? result.error : "Unable to refresh IF locations. Please try again.");
      }
      if (!Array.isArray(result?.data?.aircraft) || !Number.isFinite(Date.parse(result.data.loadedAt))) throw new Error("IF locations returned an unexpected response. Please refresh.");
      if (mounted.current && id === requestId.current) { setStored({ data: result.data, bindings }); setExpired(false); }
    } catch (readError) {
      if (mounted.current && id === requestId.current) setError(next.signal.aborted ? "IF locations took too long to load. Please refresh." : errorMessage(readError));
    } finally {
      window.clearTimeout(timeout);
      if (mounted.current && id === requestId.current) setLoading(false);
    }
  }, [aircraftIds, bindings]);

  useEffect(() => {
    mounted.current = true;
    setStored(null); setLoading(false); setError(""); setExpired(false);
    return cancel;
  }, [bindings, cancel]);

  useEffect(() => {
    if (!snapshot) return;
    const timer = window.setTimeout(() => {
      setExpired(true);
    }, Math.max(0, Date.parse(snapshot.loadedAt) + 60000 - Date.now()));
    return () => window.clearTimeout(timer);
  }, [snapshot]);

  return { snapshot, loading, error, expired, refresh, hasLinkedAircraft: Boolean(aircraftIds) };
}
