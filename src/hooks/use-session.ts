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
};

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        if (isAuthenticated()) {
          const userToken = getToken();

          // First verify the token to get the pilot ID
          const verifyResponse = await fetch("/api/auth/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token: userToken }),
          });

          const userData = await verifyResponse.json();

          if (!userData || userData.error) {
            throw new Error(userData?.error || "Failed to verify token");
          }

          // Now fetch the pilot data using the ID from verification
          const response = await fetch(`/api/pilots/${userData.id}`);
          const data = await response.json();

          const pilotResponse = await fetch(
            `/api/pilots/${userData.id}/pireps`
          );
          const pilotData = await pilotResponse.json();
          setUser({
            ...data,
            flightTime: pilotData.statistics.totalFlightTime,
            pirepsFiled: pilotData.statistics.totalPireps,
            rank: pilotData.statistics.rank,
          });
        } else {
          setUser(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    loadSession();

    // Add event listener for storage changes
    const handleStorageChange = () => {
      loadSession();
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return { user, loading, error };
}
