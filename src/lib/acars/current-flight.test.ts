import { describe, expect, it, vi, beforeEach } from "vitest";
import * as ifApi from "../infinite-flight-api";
import {
  findCurrentFlight,
  findRecentCompletedInfiniteFlight,
} from "./current-flight";

vi.mock("../infinite-flight-api", () => ({
  getInfiniteFlightSessions: vi.fn(),
  getInfiniteFlightFlights: vi.fn(),
  getInfiniteFlightUserFlights: vi.fn(),
  getInfiniteFlightUser: vi.fn(),
  isInfiniteFlightId: (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
  normalizeInfiniteFlightId: (id: string) => (id ? id.toLowerCase() : ""),
}));

describe("current-flight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findCurrentFlight", () => {
    it("queries active sessions in parallel and finds user flight", async () => {
      vi.mocked(ifApi.getInfiniteFlightSessions).mockResolvedValue({
        data: {
          errorCode: 0,
          result: [
            { id: "00000000-0000-0000-0000-000000000001", name: "Casual" },
            { id: "00000000-0000-0000-0000-000000000002", name: "Expert" },
          ],
        },
        cacheStatus: "MISS",
      });

      vi.mocked(ifApi.getInfiniteFlightFlights).mockImplementation(
        async (sessionId) => {
          if (sessionId === "00000000-0000-0000-0000-000000000002") {
            return {
              data: {
                errorCode: 0,
                result: [
                  {
                    flightId: "00000000-0000-0000-0000-000000000010",
                    userId: "11111111-1111-1111-1111-111111111111",
                    callsign: "CSN123VG",
                  },
                ],
              },
              cacheStatus: "MISS",
            };
          }
          return {
            data: { errorCode: 0, result: [] },
            cacheStatus: "MISS",
          };
        },
      );

      const result = await findCurrentFlight(
        "11111111-1111-1111-1111-111111111111",
      );

      expect(result).not.toBeNull();
      expect(result?.sessionId).toBe("00000000-0000-0000-0000-000000000002");
      expect(result?.flight.callsign).toBe("CSN123VG");
    });
  });

  describe("findRecentCompletedInfiniteFlight", () => {
    it("selects the newest completed flight even if landingCount is 0 or missing", async () => {
      const now = Date.now();
      const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString();
      const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000).toISOString();

      vi.mocked(ifApi.getInfiniteFlightUserFlights).mockResolvedValue({
        data: {
          errorCode: 0,
          result: {
            data: [
              // Newest flight (10 mins ago), but landingCount: 0
              {
                id: "22222222-2222-2222-2222-222222222222",
                userId: "11111111-1111-1111-1111-111111111111",
                created: tenMinutesAgo,
                totalTime: 90,
                fuelUsedKg: 8500,
                landingCount: 0,
              },
              // Older flight (3 hours ago), with landingCount: 1
              {
                id: "33333333-3333-3333-3333-333333333333",
                userId: "11111111-1111-1111-1111-111111111111",
                created: threeHoursAgo,
                totalTime: 60,
                fuelUsedKg: 5000,
                landingCount: 1,
              },
            ],
          },
        },
        cacheStatus: "MISS",
      });

      const flight = await findRecentCompletedInfiniteFlight(
        "11111111-1111-1111-1111-111111111111",
      );

      expect(flight).not.toBeNull();
      // Must NOT skip the latest flight!
      expect(flight?.id).toBe("22222222-2222-2222-2222-222222222222");
    });

    it("selects the newest completed flight even if fuel is not yet finalized", async () => {
      const now = Date.now();
      const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString();
      const fiveHoursAgo = new Date(now - 5 * 60 * 60 * 1000).toISOString();

      vi.mocked(ifApi.getInfiniteFlightUserFlights).mockResolvedValue({
        data: {
          errorCode: 0,
          result: {
            data: [
              // Newest flight (fuel pending / null)
              {
                id: "44444444-4444-4444-4444-444444444444",
                userId: "11111111-1111-1111-1111-111111111111",
                created: fiveMinutesAgo,
                totalTime: 45,
                fuelUsedKg: null,
                landingCount: 1,
              },
              // Older flight with fuel finalized
              {
                id: "55555555-5555-5555-5555-555555555555",
                userId: "11111111-1111-1111-1111-111111111111",
                created: fiveHoursAgo,
                totalTime: 120,
                fuelUsedKg: 12000,
                landingCount: 1,
              },
            ],
          },
        },
        cacheStatus: "MISS",
      });

      const flight = await findRecentCompletedInfiniteFlight(
        "11111111-1111-1111-1111-111111111111",
      );

      expect(flight).not.toBeNull();
      // Must NOT return the old flight from hours ago!
      expect(flight?.id).toBe("44444444-4444-4444-4444-444444444444");
    });
  });
});
