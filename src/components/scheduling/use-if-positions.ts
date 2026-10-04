"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/utils/api";
import type { LiveAircraft } from "./types";
import { schedulingResponse } from "./use-scheduling";
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

/** Read only the visible fleet page. Upstream data expires; it never enters local storage. */
export function useIfPositions(aircraft: LiveAircraft[], admin: boolean) {
  const [stored, setStored] = useState<{ data: PositionSnapshot; bindings: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const lastInteraction = useRef(Date.now());
  const linked = aircraft.filter(tail => tail.if_aircraft_id).sort((left, right) => left.id - right.id);
  const aircraftIds = linked.map(tail => tail.id).join(",");
  const bindings = linked.map(tail => `${tail.id}:${tail.aircraft_id}:${tail.if_aircraft_id}`).join("|");
  const snapshot = stored?.bindings === bindings ? stored.data : null;

  const cancel = useCallback(() => {
    mounted.current = false; ++requestId.current; controller.current?.abort();
  }, []);

  const refresh = useCallback(async (interaction = true) => {
    if (interaction) lastInteraction.current = Date.now();
    const id = ++requestId.current;
    controller.current?.abort();
    setStored(null); setError(""); setExpired(false);
    if (!aircraftIds) { setLoading(false); return; }
    const next = new AbortController(); controller.current = next; setLoading(true);
    const timeout = window.setTimeout(() => next.abort(), 25000);
    try {
      const endpoint = admin ? "/api/admin/scheduling/if/positions" : "/api/scheduling/if/positions";
      const result = await schedulingResponse(await authFetch(`${endpoint}?aircraftIds=${encodeURIComponent(aircraftIds)}`, { cache: "no-store", signal: next.signal }));
      if (!Array.isArray(result?.data?.aircraft) || !Number.isFinite(Date.parse(result.data.expiresAt))) throw new Error("IF locations returned an unexpected response. Please refresh.");
      if (mounted.current && id === requestId.current) setStored({ data: result.data, bindings });
    } catch (readError) {
      if (mounted.current && id === requestId.current) setError(next.signal.aborted ? "IF locations took too long to load. Please refresh." : errorMessage(readError));
    } finally {
      window.clearTimeout(timeout);
      if (mounted.current && id === requestId.current) setLoading(false);
    }
  }, [admin, aircraftIds, bindings]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    const onInteraction = () => { lastInteraction.current = Date.now(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pointerdown", onInteraction, { passive: true });
    window.addEventListener("keydown", onInteraction);
    return () => {
      cancel();
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", onInteraction);
      window.removeEventListener("keydown", onInteraction);
    };
  }, [refresh, cancel]);

  useEffect(() => {
    if (!snapshot) return;
    const timer = window.setTimeout(() => {
      setStored(null); setExpired(true);
      if (document.visibilityState === "visible" && Date.now() - lastInteraction.current < 15 * 60 * 1000) void refresh(false);
    }, Math.max(0, Math.min(60000, Date.parse(snapshot.expiresAt) - Date.now())));
    return () => window.clearTimeout(timer);
  }, [snapshot, refresh]);

  return { snapshot, loading, error, expired, refresh, hasLinkedAircraft: Boolean(aircraftIds) };
}
