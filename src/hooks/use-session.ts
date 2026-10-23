"use client";

import { useEffect, useState } from "react";
import { getToken, isAuthenticated } from "@/lib/utils/auth";
import { authFetch } from "../lib/utils/api";

export type User = {
  callsign: string;
  id: string;
  name: string;
  email: string;
  rank: string;
  flightTime: string;
  pirepsFiled: number;
  joined: string;
  status: number;
  canAccessLiveScheduling: boolean;
  Permissions: Array<{
    userid: string;
    name: string;
  }>;
};

let cachedUser: User | null = null;
let cachedToken: string | null = null;
let inflightSessionPromise: Promise<User | null> | null = null;

export function clearSessionCache() {
  cachedUser = null;
  cachedToken = null;
  inflightSessionPromise = null;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 8000,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await authFetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function resolveSessionUser(userToken: string): Promise<User> {
  const verifyResponse = await fetchWithTimeout("/api/auth/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token: userToken }),
  });

  if (!verifyResponse.ok) {
    throw new Error("Failed to verify session");
  }

  const userData = await verifyResponse.json();

  if (!userData || userData.error) {
    throw new Error(userData?.error || "Failed to verify token");
  }

  let pilotData: {
    statistics?: {
      totalFlightTime?: string;
      totalPireps?: number;
      rank?: string;
    };
  } | null = null;

  if (userData.status === 1) {
    try {
      const pilotResponse = await fetchWithTimeout(
        `/api/pilots/${userData.id}/pireps`,
      );
      if (pilotResponse.ok) {
        pilotData = await pilotResponse.json();
      }
    } catch (statsError) {
      console.error("Failed to load pilot statistics:", statsError);
    }
  }

  const baseUser: User = {
    ...userData,
    canAccessLiveScheduling: userData.canAccessLiveScheduling === true,
    flightTime:
      pilotData?.statistics?.totalFlightTime ?? userData.flightTime ?? "00:00",
    pirepsFiled:
      pilotData?.statistics?.totalPireps ?? userData.pirepsFiled ?? 0,
    rank: pilotData?.statistics?.rank ?? userData.rank ?? "Trainee",
  };

  return baseUser;
}

export function useSession() {
  const currentToken = typeof window !== "undefined" ? getToken() : null;
  const hasValidCache =
    Boolean(cachedUser) && cachedToken === currentToken && isAuthenticated();

  const [user, setUser] = useState<User | null>(() =>
    hasValidCache ? cachedUser : null,
  );
  const [loading, setLoading] = useState<boolean>(() => !hasValidCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async (forceRefresh = false) => {
      try {
        if (!isAuthenticated()) {
          clearSessionCache();
          if (isMounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        const userToken = getToken();
        if (!userToken) {
          clearSessionCache();
          if (isMounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        if (!forceRefresh && cachedUser && cachedToken === userToken) {
          if (isMounted) {
            setUser(cachedUser);
            setLoading(false);
          }
          return;
        }

        if (isMounted && !cachedUser) {
          setLoading(true);
        }
        setError(null);

        if (!inflightSessionPromise || forceRefresh) {
          inflightSessionPromise = resolveSessionUser(userToken)
            .then((resolved) => {
              cachedUser = resolved;
              cachedToken = userToken;
              return resolved;
            })
            .finally(() => {
              inflightSessionPromise = null;
            });
        }

        const resolvedUser = await inflightSessionPromise;
        if (isMounted) {
          setUser(resolvedUser);
        }
      } catch (err) {
        clearSessionCache();
        if (isMounted) {
          setUser(null);
          setError(err instanceof Error ? err.message : "An error occurred");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadSession(false);

    const handleStorageChange = () => {
      void loadSession(true);
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return { user, loading, error };
}
