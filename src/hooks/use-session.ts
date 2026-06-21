"use client";

import { useEffect, useState } from "react";
import { getToken, isAuthenticated } from "@/lib/utils/auth";

type User = {
  callsign: string;
  id: string;
  name: string;
  email: string;
  rank: string;
  flightTime: string;
  pirepsFiled: number;
  joined: string;
  status: number;
  Permissions: Array<{
    userid: string;
    name: string;
  }>;
};

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 8000
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        setLoading(true);
        setError(null);

        if (isAuthenticated()) {
          const userToken = getToken();

          // First verify the token to get the pilot ID
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

          const pilotResponse = await fetchWithTimeout(
            `/api/pilots/${userData.id}/pireps`
          );

          if (!pilotResponse.ok) {
            throw new Error("Failed to load pilot statistics");
          }

          const pilotData = await pilotResponse.json();

          if (isMounted) {
            setUser({
              ...userData,
              flightTime: pilotData?.statistics?.totalFlightTime ?? "0",
              pirepsFiled: pilotData?.statistics?.totalPireps ?? 0,
              rank: pilotData?.statistics?.rank ?? userData.rank,
            });
          }
        } else {
          if (isMounted) {
            setUser(null);
          }
        }
      } catch (err) {
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

    loadSession();

    // Add event listener for storage changes
    const handleStorageChange = () => {
      loadSession();
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return { user, loading, error };
}
