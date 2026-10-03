"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/utils/api";
import { SchedulingData } from "./types";
import { errorMessage } from "./utils";

export async function schedulingResponse(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    const details = typeof body?.message === "string" ? body.message : typeof body?.error === "string" ? body.error : "Unable to load scheduling. Please try again.";
    throw new Error(details);
  }
  return body;
}

export function useScheduling(admin: boolean) {
  const endpoint = admin ? "/api/admin/scheduling" : "/api/scheduling";
  const [data, setData] = useState<SchedulingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const mounted = useRef(true);
  const cancelRequests = useCallback(() => {
    ++requestId.current;
    controller.current?.abort();
  }, []);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setRefreshing(true);
    const timeout = window.setTimeout(() => nextController.abort(), 15000);
    try {
      const response = await authFetch(endpoint, { signal: nextController.signal, cache: "no-store" });
      if ([401, 403].includes(response.status) && mounted.current && id === requestId.current) setData(null);
      const result = await schedulingResponse(response);
      const payload = result?.data?.aircraft ? result.data : result;
      if (!Array.isArray(payload?.aircraft) || !Array.isArray(payload?.flights)) throw new Error("Scheduling returned an unexpected response. Please refresh.");
      if (mounted.current && id === requestId.current) {
        setData(payload);
        setError("");
      }
    } catch (loadError) {
      if (mounted.current && id === requestId.current) {
        setError(nextController.signal.aborted ? "Scheduling took too long to respond. Please refresh." : errorMessage(loadError));
      }
    } finally {
      window.clearTimeout(timeout);
      if (mounted.current && id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [endpoint]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const onFocus = () => { void refresh(); };
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    window.addEventListener("focus", onFocus);
    return () => {
      mounted.current = false;
      cancelRequests();
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, cancelRequests]);

  const mutate = useCallback(async (body: Record<string, unknown>, method: "POST" | "PATCH" = "PATCH") => {
    const response = await authFetch(endpoint, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if ([401, 403].includes(response.status) && mounted.current) setData(null);
    await schedulingResponse(response);
    await refresh();
  }, [endpoint, refresh]);

  return { data, loading, refreshing, error, refresh, mutate };
}
