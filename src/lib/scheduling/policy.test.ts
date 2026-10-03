import { describe, expect, it } from "vitest";
import { airport, text, overlaps, scheduledWindow, projectedOrigin, validateQueue } from "./policy";

const leg = (id: number, departure: string, arrival: string, start: number, end: number, status = "approved") => ({ id, departure, arrival, status, scheduled_departure: `2026-10-02T${String(start).padStart(2, "0")}:00:00Z`, scheduled_arrival: `2026-10-02T${String(end).padStart(2, "0")}:00:00Z` });
describe("live aircraft scheduling policy", () => {
  it("normalizes ICAOs and permits an unknown initial airport", () => {
    expect(airport(" cyyz ")).toBe("CYYZ"); expect(airport("", true)).toBeNull();
    expect(() => airport("TORONTO")).toThrow("four");
  });
  it("accepts optional callsigns and rejects control characters", () => {
    expect(text("", 32, "Callsign")).toBeNull(); expect(text(undefined, 32, "Callsign")).toBeNull();
    expect(() => text("CZV\u0000", 32, "Callsign")).toThrow("invalid");
  });
  it("requires unambiguous timezone and positive flight interval", () => {
    expect(() => scheduledWindow("2026-10-02T10:00", "2026-10-02T11:00")).toThrow("UTC offset");
    expect(() => scheduledWindow("2026-10-02T10:00Z", "2026-10-02T09:00Z")).toThrow("after");
    expect(scheduledWindow("2026-10-02T10:00Z", "2026-10-02T11:00Z").scheduled_arrival.toISOString()).toBe("2026-10-02T11:00:00.000Z");
  });
  it("does not count pending proposals as the next location", () => {
    expect(projectedOrigin("CYYZ", [leg(1, "CYYZ", "KJFK", 8, 9, "pending")], new Date("2026-10-02T10:00Z"))).toBe("CYYZ");
  });
  it("derives origin from preceding approved arrival, not later flights", () => {
    expect(projectedOrigin("CYYZ", [leg(1, "CYYZ", "KJFK", 8, 9), leg(2, "KJFK", "EGLL", 12, 19)], new Date("2026-10-02T10:00Z"))).toBe("KJFK");
  });
  it("validates continuous chained legs regardless of input ordering", () => {
    expect(() => validateQueue("CYYZ", [leg(2, "KJFK", "EGLL", 10, 17), leg(1, "CYYZ", "KJFK", 8, 9)])).not.toThrow();
  });
  it("rejects a wrong origin after a diversion or cancellation", () => {
    expect(() => validateQueue("KBOS", [leg(2, "KJFK", "EGLL", 10, 17)])).toThrow("KBOS");
  });
  it("permits adjacent intervals and rejects actual overlap", () => {
    expect(overlaps(leg(1, "CYYZ", "KJFK", 8, 10), leg(2, "KJFK", "EGLL", 10, 17))).toBe(false);
    expect(() => validateQueue("CYYZ", [leg(1, "CYYZ", "KJFK", 8, 11), leg(2, "KJFK", "EGLL", 10, 17)])).toThrow("overlapping");
  });
  it("allows admin approval to confirm the first location when unknown", () => {
    expect(projectedOrigin(null, [], new Date("2026-10-02T10:00Z"))).toBeNull();
    expect(() => validateQueue(null, [leg(1, "CYYZ", "KJFK", 8, 9)])).not.toThrow();
  });
});
