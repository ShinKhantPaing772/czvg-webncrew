"use client";

import { useEffect, useState } from "react";
import { getToken, isAuthenticated } from "@/lib/utils/auth";
import { authFetch } from "@/lib/utils/api";

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
    return await authFetch(input, {
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

          let pilotData = null;
          try {
            const pilotResponse = await fetchWithTimeout(
              `/api/pilots/${userData.id}/pireps`
            );

            if (pilotResponse.ok) {
              pilotData = await pilotResponse.json();
            } else {
              throw new Error("Failed to load pilot statistics");
            }
          } catch (statsError) {
            console.error("Failed to load pilot statistics:", statsError);
            if (isMounted) {
              setError("Failed to load pilot statistics");
            }
          }

          if (isMounted) {
            setUser({
              ...userData,
              flightTime: pilotData?.statistics?.totalFlightTime ?? "00:00",
              pirepsFiled: pilotData?.statistics?.totalPireps ?? 0,
              rank: pilotData?.statistics?.rank ?? userData.rank ?? "Trainee",
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
