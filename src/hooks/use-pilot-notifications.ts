"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/utils/api";
import type {
  PilotNotification,
  PilotNotificationsResponse,
} from "@/lib/notifications";

export const NOTIFICATIONS_POLL_MS = 3 * 60_000;
export const NOTIFICATIONS_LIST_LIMIT = 20;

type InboxState = {
  pilotId: string | null;
  notifications: PilotNotification[];
  unreadCount: number;
  status: "idle" | "loading" | "ready" | "error";
};

export type PilotNotificationsInbox = Omit<InboxState, "pilotId"> & {
  refresh: () => Promise<void>;
  /** Marks the given notifications read, or every unread one when omitted. */
  markRead: (ids?: number[]) => Promise<void>;
};

// Every crew page renders its own CrewHeader, so keep the last inbox across
// route changes (like persistedSidebarOpen) to stop the badge blinking.
let persistedInbox: InboxState | null = null;

function startingState(pilotId: string | null): InboxState {
  if (pilotId && persistedInbox?.pilotId === pilotId) return persistedInbox;
  return { pilotId, notifications: [], unreadCount: 0, status: "idle" };
}

export function usePilotNotifications(
  pilotId?: string | number | null,
): PilotNotificationsInbox {
  const id = pilotId ? String(pilotId) : null;
  const [stored, setStored] = useState(() => startingState(id));
  const state = stored.pilotId === id ? stored : startingState(id);
  const requestSeq = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (state.pilotId && state.status === "ready") persistedInbox = state;
  }, [state]);

  const update = useCallback(
    (next: (current: InboxState) => InboxState) =>
      setStored((prev) => next(prev.pilotId === id ? prev : startingState(id))),
    [id],
  );

  const refresh = useCallback(async () => {
    if (!id) return;
    const seq = ++requestSeq.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    update((current) =>
      current.status === "ready" ? current : { ...current, status: "loading" },
    );

    try {
      // Passing a signal also skips authFetch's 15s GET cache.
      const response = await authFetch(
        `/api/pilots/${id}/notifications?limit=${NOTIFICATIONS_LIST_LIMIT}`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as PilotNotificationsResponse;
      if (seq !== requestSeq.current) return;
      update(() => ({
        pilotId: id,
        notifications: Array.isArray(data.notifications)
          ? data.notifications
          : [],
        unreadCount: Number(data.unreadCount) || 0,
        status: "ready",
      }));
    } catch {
      if (seq !== requestSeq.current) return;
      // Keep showing the last good inbox; only an empty one shows the error.
      update((current) =>
        current.status === "ready" ? current : { ...current, status: "error" },
      );
    }
  }, [id, update]);

  useEffect(() => {
    if (!id) return;
    void refresh();

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const poll = window.setInterval(refreshIfVisible, NOTIFICATIONS_POLL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      requestSeq.current += 1;
      controllerRef.current?.abort();
    };
  }, [id, refresh]);

  const markRead = useCallback(
    async (ids?: number[]) => {
      if (!id) return;
      // Loads already in flight predate this change; drop their answers.
      requestSeq.current += 1;
      controllerRef.current?.abort();

      const readAt = new Date().toISOString();
      const targets = ids ? new Set(ids) : null;
      update((current) => {
        let cleared = 0;
        const notifications = current.notifications.map((notification) => {
          if (notification.readAt) return notification;
          if (targets && !targets.has(notification.id)) return notification;
          cleared += 1;
          return { ...notification, readAt };
        });
        return {
          ...current,
          notifications,
          unreadCount: targets ? Math.max(0, current.unreadCount - cleared) : 0,
        };
      });

      try {
        await authFetch(`/api/pilots/${id}/notifications`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ids ? { ids } : { all: true }),
        });
      } catch {
        // The reload below puts back whatever the server has.
      }
      await refresh();
    },
    [id, refresh, update],
  );

  return {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    status: state.status,
    refresh,
    markRead,
  };
}
