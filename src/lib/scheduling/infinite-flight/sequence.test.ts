import { describe, expect, it } from "vitest";
import { planIfSequence } from "./sequence";
import { scheduleMarker } from "./sync";
import type { IfSchedule } from "./types";

const publicIds = [1, 2, 3].map(value => `10000000-0000-0000-0000-${String(value).padStart(12, "0")}`);
const remoteIds = [1, 2, 3, 4].map(value => `20000000-0000-0000-0000-${String(value).padStart(12, "0")}`);
const local = publicIds.map(public_id => ({ public_id }));
function row(index: number, overrides: Partial<IfSchedule> = {}): IfSchedule {
  return { id: remoteIds[index], aircraftId: publicIds[0], organizationId: publicIds[0], status: 1, callsign: `WNC${index}`, flightType: 1,
    originIcao: "CYYZ", destinationIcao: "CYVR", scheduledDepartureUtc: "2026-10-04T10:00:00Z", scheduledArrivalUtc: "2026-10-04T15:00:00Z",
    briefing: index < 3 ? scheduleMarker(publicIds[index]) : "External reservation", flightPlan: null, crew: [], ...overrides };
}

describe("safe IF schedule sequence reconciliation", () => {
  it("does not write when managed reservations already follow the local queue", () => {
    expect(planIfSequence([row(0), row(1), row(2)], local, remoteIds[1])).toBeNull();
  });
  it("moves an appended first leg to the top", () => {
    expect(planIfSequence([row(1), row(2), row(0)], local, remoteIds[0])).toEqual({ scheduleId: remoteIds[0], afterId: null });
  });
  it("moves a leg after the preceding managed reservation", () => {
    expect(planIfSequence([row(0), row(2), row(1)], local, remoteIds[1])).toEqual({ scheduleId: remoteIds[1], afterId: remoteIds[0] });
  });
  it("preserves an external prefix and uses its boundary as the anchor", () => {
    expect(planIfSequence([row(3), row(1), row(0)], local.slice(0, 2), remoteIds[0])).toEqual({ scheduleId: remoteIds[0], afterId: remoteIds[3] });
  });
  it("rejects a move that would cross an external reservation", () => {
    expect(() => planIfSequence([row(1), row(3), row(0)], local.slice(0, 2), remoteIds[0])).toThrow("external or active IF reservation");
  });
  it("rejects a lone appended leg that should chronologically precede an external future leg", () => {
    const external = row(3, { scheduledDepartureUtc: "2026-10-04T20:00:00Z", scheduledArrivalUtc: "2026-10-05T01:00:00Z" });
    expect(() => planIfSequence([external, row(0)], local.slice(0, 1), remoteIds[0])).toThrow("wrong side");
  });
  it("rejects a lone local leg ordered before an earlier external leg", () => {
    const external = row(3, { scheduledDepartureUtc: "2026-10-04T04:00:00Z", scheduledArrivalUtc: "2026-10-04T09:00:00Z" });
    expect(() => planIfSequence([row(0), external], local.slice(0, 1), remoteIds[0])).toThrow("wrong side");
  });
  it("accepts a correctly placed lone local leg after an earlier external booking", () => {
    const external = row(3, { scheduledDepartureUtc: "2026-10-04T04:00:00Z", scheduledArrivalUtc: "2026-10-04T09:00:00Z" });
    expect(planIfSequence([external, row(0)], local.slice(0, 1), remoteIds[0])).toBeNull();
  });
  it("does not move a reservation that has begun", () => {
    expect(() => planIfSequence([row(1), row(0, { status: 6 })], local.slice(0, 2), remoteIds[0])).toThrow("has started");
  });
  it("does not shift an in-flight leg while moving another managed leg", () => {
    expect(() => planIfSequence([row(1, { status: 6 }), row(0)], local.slice(0, 2), remoteIds[0])).toThrow("external or active IF reservation");
  });
  it("stops when the other managed legs require independent reconciliation", () => {
    expect(() => planIfSequence([row(2), row(1), row(0)], local, remoteIds[0])).toThrow("Other IF legs");
  });
  it("ignores the documented cancelled and arrived history states", () => {
    expect(planIfSequence([row(3, { status: 9 }), row(1), row(3, { id: "30000000-0000-0000-0000-000000000003", status: 11 }), row(0)], local.slice(0, 2), remoteIds[0])).toEqual({ scheduleId: remoteIds[0], afterId: null });
  });
  it("requires reconciliation if the known target disappeared", () => {
    expect(() => planIfSequence([row(1)], local, remoteIds[0])).toThrow("disappeared");
  });
});
