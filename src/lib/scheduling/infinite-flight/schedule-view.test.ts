import { describe, expect, it } from "vitest";
import { ifScheduleFingerprint, meaningfulIfScheduleTime, toIfAircraftScheduleView } from "./schedule-view";
import type { IfSchedule } from "./types";

const ID = "10000000-0000-0000-0000-000000000001";
const OTHER = "10000000-0000-0000-0000-000000000002";
const remote: IfSchedule = { id: ID, aircraftId: OTHER, organizationId: ID, callsign: "IF1", flightType: 1, originIcao: "CYYZ", destinationIcao: "CYVR",
  scheduledDepartureUtc: "2026-10-06T10:00:00Z", scheduledArrivalUtc: "2026-10-06T15:00:00Z", briefing: "Provider private notes", flightPlan: "Provider private plan", status: 1, crew: [{ userId: OTHER, role: 0 }], sequence: 3 };

describe("temporary IF schedule display and edit guards", () => {
  it.each(["0001-01-01T00:00:00Z", "0001-01-01T00:00:00.0000000Z", "2026-10-06T10:00:00", "invalid", "", null, undefined])("displays missing or ambiguous provider time %s as unset", value => {
    expect(meaningfulIfScheduleTime(value)).toBeNull();
  });
  it("normalizes explicit timezone offsets to UTC without retaining year-one sentinels", () => {
    expect(meaningfulIfScheduleTime("2026-10-06T12:00:00+02:00")).toBe("2026-10-06T10:00:00.000Z");
    const view = toIfAircraftScheduleView({ ...remote, scheduledDepartureUtc: "0001-01-01T00:00:00Z", scheduledArrivalUtc: "0001-01-01T00:00:00Z" }, [], true);
    expect(view).toMatchObject({ scheduledDepartureUtc: null, scheduledArrivalUtc: null, sequence: 3, editable: true, flightType: 1 });
    expect(JSON.stringify(view)).not.toMatch(/Provider private|organizationId|aircraftId|briefing|flightPlan/);
  });
  it.each([1, 2, 3, 4, 6, 7, 8, 10])("permits admin edits before arrival in status %s", status => {
    expect(toIfAircraftScheduleView({ ...remote, status }, [], true)).toMatchObject({ editable: true, editDisabledReason: null });
  });
  it.each([0, 9, 11])("locks a terminal or unknown IF flight in status %s", status => {
    expect(toIfAircraftScheduleView({ ...remote, status }, [], true).editable).toBe(false);
  });
  it("locks an arrived flight even if IF reports an inconsistent unfinished status", () => {
    expect(toIfAircraftScheduleView({ ...remote, actualArrivalUtc: "2026-10-06T15:00:00Z" }, [], true)).toMatchObject({ editable: false, editDisabledReason: "Arrived flights are locked" });
  });
  it("routes a known local flight or an orphaned app marker through local repair", () => {
    const local = { id: 23, public_id: OTHER, if_schedule_id: ID, status: "approved" };
    expect(toIfAircraftScheduleView(remote, [local], true)).toMatchObject({ managedFlightId: 23, editable: false, editDisabledReason: expect.stringContaining("local scheduling") });
    expect(toIfAircraftScheduleView({ ...remote, briefing: `[WNC schedule:${OTHER}]` }, [], true)).toMatchObject({ managedFlightId: null, editable: false });
  });
  it("does not expose write access in a pilot view", () => {
    expect(toIfAircraftScheduleView(remote)).toMatchObject({ editable: false, editDisabledReason: expect.stringContaining("administrator") });
  });
  it.each([{ callsign: "IF2" }, { flightType: 3 }, { status: 11 }, { sequence: 4 }, { updatedAt: "2026-10-06T10:00:01Z" },
    { briefing: "Changed" }, { crew: [] }, { actualArrivalUtc: "2026-10-06T15:00:00Z" }])("detects concurrent provider changes without exposing source fields: %j", changes => {
    expect(ifScheduleFingerprint({ ...remote, ...changes })).not.toBe(ifScheduleFingerprint(remote));
    expect(ifScheduleFingerprint(remote)).toMatch(/^[0-9a-f]{64}$/);
  });
});
