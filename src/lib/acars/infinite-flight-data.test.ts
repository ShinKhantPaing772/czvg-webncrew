import { describe, expect, it } from "vitest";
import {
  extractAirportFromFlightPlan,
  extractAirportFromRecord,
  extractFlightTime,
  parseInfiniteFlightDate,
} from "./infinite-flight-data";

describe("infinite-flight-data", () => {
  describe("parseInfiniteFlightDate", () => {
    it("parses standard ISO date strings", () => {
      const date = parseInfiniteFlightDate("2026-10-26T15:30:00Z");
      expect(date).not.toBeNull();
      expect(date?.toISOString()).toBe("2026-10-26T15:30:00.000Z");
    });

    it("parses space-separated date strings without crashing or returning invalid date", () => {
      const date = parseInfiniteFlightDate("2026-10-26 15:30:00Z");
      expect(date).not.toBeNull();
      expect(date?.toISOString()).toBe("2026-10-26T15:30:00.000Z");
    });

    it("parses space-separated date strings without timezone by treating as UTC", () => {
      const date = parseInfiniteFlightDate("2026-10-26 15:30:00");
      expect(date).not.toBeNull();
      expect(date?.toISOString()).toBe("2026-10-26T15:30:00.000Z");
    });

    it("returns null for invalid inputs", () => {
      expect(parseInfiniteFlightDate(null)).toBeNull();
      expect(parseInfiniteFlightDate("not-a-date")).toBeNull();
      expect(parseInfiniteFlightDate("")).toBeNull();
    });
  });

  describe("extractFlightTime", () => {
    it("extracts flight time from totalTime in minutes", () => {
      expect(extractFlightTime({ totalTime: 142.5 })).toBe("02:22");
      expect(extractFlightTime({ totalTime: 60 })).toBe("01:00");
      expect(extractFlightTime({ totalTime: 45 })).toBe("00:45");
    });

    it("extracts flight time from numeric strings", () => {
      expect(extractFlightTime({ totalTime: "120" })).toBe("02:00");
    });

    it("computes duration from created and lastReport for live flights", () => {
      const time = extractFlightTime({
        created: "2026-10-26T10:00:00Z",
        lastReport: "2026-10-26T11:45:00Z",
      });
      expect(time).toBe("01:45");
    });

    it("returns empty string when no duration can be determined", () => {
      expect(extractFlightTime({})).toBe("");
    });
  });

  describe("extractAirportFromRecord", () => {
    it("extracts ICAO codes from record fields", () => {
      expect(
        extractAirportFromRecord({ departure: "ZGGG" }, ["departure"]),
      ).toBe("ZGGG");
      expect(
        extractAirportFromRecord(
          { departureAirport: { icao: "VHHH" } },
          ["departureAirport"],
        ),
      ).toBe("VHHH");
    });
  });

  describe("extractAirportFromFlightPlan", () => {
    it("extracts origin and destination from flight plan items", () => {
      const plan = {
        flightPlanItems: [
          { name: "ZGGG" },
          { name: "P123" },
          { name: "ZSPD" },
        ],
      };
      expect(extractAirportFromFlightPlan(plan, 0)).toBe("ZGGG");
      expect(extractAirportFromFlightPlan(plan, -1)).toBe("ZSPD");
    });
  });
});
