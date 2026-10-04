import { describe, expect, it } from "vitest";
import { airport, text, overlaps, scheduledWindow, projectedOrigin, orderedQueue, validateQueue } from "./policy";

const leg = (id: number, departure: string, arrival: string, start: number, end: number, status = "approved") => ({ id, queue_order: status === "pending" ? null : id, departure, arrival, status, scheduled_departure: `2026-10-02T${String(start).padStart(2, "0")}:00:00Z`, scheduled_arrival: `2026-10-02T${String(end).padStart(2, "0")}:00:00Z` });
const untimed = (id: number, departure: string, arrival: string) => ({ ...leg(id, departure, arrival, 8, 9), scheduled_departure: null, scheduled_arrival: null });
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
    expect(scheduledWindow("2026-10-02T10:00Z", "2026-10-02T11:00Z").scheduled_arrival?.toISOString()).toBe("2026-10-02T11:00:00.000Z");
    expect(() => scheduledWindow("0001-01-01T00:00:00Z", "0001-01-02T00:00:00Z")).toThrow("Invalid schedule time");
    expect(() => scheduledWindow("2026-02-30T10:00:00Z", "2026-03-01T11:00:00Z")).toThrow("Invalid schedule time");
  });
  it("accepts omitted times without inventing a schedule interval", () => {
    expect(scheduledWindow(undefined, undefined)).toEqual({ scheduled_departure: null, scheduled_arrival: null });
    expect(scheduledWindow(null, null)).toEqual({ scheduled_departure: null, scheduled_arrival: null });
    expect(() => scheduledWindow(null, "2026-10-02T11:00Z")).toThrow("both");
    expect(() => scheduledWindow("2026-10-02T10:00Z", null)).toThrow("both");
  });
  it("does not count pending proposals as the next location", () => {
    expect(projectedOrigin("CYYZ", [leg(1, "CYYZ", "KJFK", 8, 9, "pending")])).toBe("CYYZ");
  });
  it("derives origin from preceding approved arrival, not later flights", () => {
    expect(projectedOrigin("CYYZ", [leg(1, "CYYZ", "KJFK", 8, 9), leg(2, "KJFK", "EGLL", 12, 19)], 2)).toBe("KJFK");
    expect(projectedOrigin("CYYZ", [leg(1, "CYYZ", "KJFK", 8, 9), untimed(2, "KJFK", "EGLL")])).toBe("EGLL");
  });
  it("orders untimed legs by their reserved queue position, independently of clocks or row IDs", () => {
    const first = { ...untimed(8, "CYYZ", "KJFK"), queue_order: 1 }, second = { ...untimed(2, "KJFK", "EGLL"), queue_order: 2 };
    expect(orderedQueue([second, first]).map(row => row.id)).toEqual([8, 2]);
    expect(() => validateQueue("CYYZ", [second, first])).not.toThrow();
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
    expect(overlaps(untimed(1, "CYYZ", "KJFK"), leg(2, "KJFK", "EGLL", 10, 17))).toBe(false);
  });
  it("checks timed legs across untimed intermediate legs without changing the route order", () => {
    expect(() => validateQueue("CYYZ", [leg(1, "CYYZ", "KJFK", 8, 11), untimed(2, "KJFK", "KBOS"), leg(3, "KBOS", "EGLL", 10, 17)])).toThrow("overlapping");
    expect(() => validateQueue("CYYZ", [leg(1, "CYYZ", "KJFK", 8, 9), untimed(2, "KJFK", "KBOS"), leg(3, "KBOS", "EGLL", 10, 17)])).not.toThrow();
  });
  it("allows admin approval to confirm the first location when unknown", () => {
    expect(projectedOrigin(null, [])).toBeNull();
    expect(() => validateQueue(null, [leg(1, "CYYZ", "KJFK", 8, 9)])).not.toThrow();
  });
});
