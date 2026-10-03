import { describe, expect, it, vi } from "vitest";
import { IfLiveError } from "./config";
import { buildIfPayload, scheduleMarker, synchronizeIfFlight, type SyncApi } from "./sync";
import type { AuthoredIfPayload, IfSchedule } from "./types";

const PUBLIC_ID = "10000000-0000-0000-0000-000000000001";
const REMOTE_ID = "20000000-0000-0000-0000-000000000002";
const CAPTAIN = "30000000-0000-0000-0000-000000000003";
const FO = "40000000-0000-0000-0000-000000000004";
const flight = { id: 9, public_id: PUBLIC_ID, callsign: null, departure: "CYYZ", arrival: "CYVR", scheduled_departure: new Date("2026-10-04T10:00:00Z"), scheduled_arrival: new Date("2026-10-04T15:00:00Z"), notes: "Test service" };
function authored(): AuthoredIfPayload { return buildIfPayload(flight, [{ userId: CAPTAIN, role: 0 }]); }
function schedule(payload = authored(), crew = payload.crew): IfSchedule { return { ...payload.schedule, id: REMOTE_ID, aircraftId: PUBLIC_ID, organizationId: PUBLIC_ID, status: 1, crew }; }
function apiFor(payload = authored()): SyncApi {
  let remote = schedule(payload, []);
  return {
    create: vi.fn(async () => remote), update: vi.fn(async (_id, body) => (remote = { ...remote, ...body })), remove: vi.fn(async () => undefined),
    putCrew: vi.fn(async (_id, crew) => (remote = { ...remote, crew: [...remote.crew.filter(row => row.userId !== crew.userId), crew] })),
    removeCrew: vi.fn(async (_id, userId) => (remote = { ...remote, crew: remote.crew.filter(row => row.userId !== userId) })),
  };
}
function input(overrides: Partial<Parameters<typeof synchronizeIfFlight>[0]> = {}) {
  return { publicId: PUBLIC_ID, remoteId: null, schedules: [], desired: authored(), previous: null, action: "sync" as const, uncertainCreation: false, api: apiFor(), checkpoint: vi.fn(async () => undefined), ...overrides };
}

describe("IF reconciliation", () => {
  it("authors a stable marker and callsign without changing optional local input", () => {
    const value = authored(); expect(value.schedule.callsign).toBe("WNC9"); expect(flight.callsign).toBeNull();
    expect(value.schedule.briefing).toContain(scheduleMarker(PUBLIC_ID));
  });
  it("rejects more than three crew or missing/duplicate IF identifiers", () => {
    expect(() => buildIfPayload(flight, [{ userId: CAPTAIN, role: 0 }, { userId: CAPTAIN, role: 1 }])).toThrow("distinct IF user IDs");
    expect(() => buildIfPayload(flight, [{ userId: "", role: 0 }])).toThrow();
  });
  it("creates once and checkpoints the binding before assigning crew", async () => {
    const value = input(); const order: string[] = [];
    vi.mocked(value.checkpoint).mockImplementation(async () => { order.push("checkpoint"); });
    vi.mocked(value.api.putCrew).mockImplementation(async (_id, crew) => { order.push("crew"); return schedule(authored(), [crew]); });
    await expect(synchronizeIfFlight(value)).resolves.toEqual({ remoteId: REMOTE_ID, removed: false });
    expect(value.api.create).toHaveBeenCalledOnce(); expect(order.indexOf("checkpoint")).toBeLessThan(order.indexOf("crew"));
  });
  it("reconciles an uncertain POST by its marker without sending POST again", async () => {
    const value = input({ schedules: [schedule(authored(), [])], uncertainCreation: true });
    await synchronizeIfFlight(value); expect(value.api.create).not.toHaveBeenCalled(); expect(value.api.putCrew).toHaveBeenCalledOnce();
  });
  it("will not automatically repeat a POST whose outcome is unknown", async () => {
    const value = input({ uncertainCreation: true });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "reconciliation" });
    expect(value.api.create).not.toHaveBeenCalled();
  });
  it("allows explicit recreation after an admin reviews the missing reservation", async () => {
    const value = input({ uncertainCreation: true, action: "recreate" });
    await synchronizeIfFlight(value); expect(value.api.create).toHaveBeenCalledOnce();
  });
  it("does not recreate an existing marked reservation even when recreation is selected", async () => {
    const value = input({ schedules: [schedule()], action: "recreate" });
    await synchronizeIfFlight(value); expect(value.api.create).not.toHaveBeenCalled();
  });
  it("rejects duplicate markers instead of picking an arbitrary schedule", async () => {
    const value = input({ schedules: [schedule(), { ...schedule(), id: FO }] });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict" }); expect(value.api.create).not.toHaveBeenCalled();
  });
  it("does not edit an unowned linked schedule, including explicit overwrite", async () => {
    const value = input({ remoteId: REMOTE_ID, schedules: [{ ...schedule(), briefing: "External reservation" }], action: "overwrite" });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict" }); expect(value.api.update).not.toHaveBeenCalled();
  });
  it("requires review before overwriting outside edits", async () => {
    const value = input({ remoteId: REMOTE_ID, previous: authored(), schedules: [{ ...schedule(), destinationIcao: "KLAX" }] });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict" }); expect(value.api.update).not.toHaveBeenCalled();
  });
  it("permits an explicit overwrite of an owned scheduled reservation", async () => {
    const value = input({ remoteId: REMOTE_ID, previous: authored(), schedules: [{ ...schedule(), destinationIcao: "KLAX" }], action: "overwrite" });
    await synchronizeIfFlight(value); expect(value.api.update).toHaveBeenCalledOnce();
  });
  it("rejects an overlapping external booking before creating or assigning crew", async () => {
    const value = input({ schedules: [{ ...schedule(), id: FO, briefing: "External booking" }] });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("overlaps") });
    expect(value.api.create).not.toHaveBeenCalled(); expect(value.api.update).not.toHaveBeenCalled(); expect(value.api.putCrew).not.toHaveBeenCalled(); expect(value.api.removeCrew).not.toHaveBeenCalled();
  });
  it("rejects overlaps with another managed leg before updating a reservation", async () => {
    const previous = authored(); const desired = { ...previous, schedule: { ...previous.schedule, scheduledArrivalUtc: "2026-10-04T17:00:00Z" } };
    const other = { ...schedule(), id: FO, briefing: scheduleMarker(FO), scheduledDepartureUtc: "2026-10-04T16:00:00Z", scheduledArrivalUtc: "2026-10-04T21:00:00Z" };
    const value = input({ remoteId: REMOTE_ID, previous, desired, schedules: [schedule(), other] });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict" }); expect(value.api.update).not.toHaveBeenCalled(); expect(value.api.putCrew).not.toHaveBeenCalled(); expect(value.api.removeCrew).not.toHaveBeenCalled();
  });
  it("permits adjacent reservations and ignores cancelled or arrived history", async () => {
    const value = input({ schedules: [
      { ...schedule(), id: FO, briefing: "Next booking", scheduledDepartureUtc: "2026-10-04T15:00:00Z", scheduledArrivalUtc: "2026-10-04T17:00:00Z" },
      { ...schedule(), id: CAPTAIN, briefing: "Cancelled", status: 9 }, { ...schedule(), id: PUBLIC_ID, briefing: "Arrived", status: 11 },
    ] });
    await synchronizeIfFlight(value); expect(value.api.create).toHaveBeenCalledOnce();
  });
  it("protects in-progress reservations from local cancellation", async () => {
    const value = input({ remoteId: REMOTE_ID, schedules: [{ ...schedule(), status: 6 }], previous: authored(), desired: null, action: "overwrite" });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict" }); expect(value.api.remove).not.toHaveBeenCalled();
  });
  it("deletes an unchanged app-owned scheduled reservation on cancellation", async () => {
    const value = input({ remoteId: REMOTE_ID, schedules: [schedule()], previous: authored(), desired: null });
    await expect(synchronizeIfFlight(value)).resolves.toEqual({ remoteId: null, removed: true }); expect(value.api.remove).toHaveBeenCalledWith(REMOTE_ID);
  });
  it("keeps an uncertain cancelled create in reconciliation if it cannot be found", async () => {
    await expect(synchronizeIfFlight(input({ uncertainCreation: true, desired: null }))).rejects.toMatchObject({ code: "reconciliation" });
  });
  it("resumes a partial crew publish using PUT, without repeating create", async () => {
    const desired = { ...authored(), crew: [{ userId: CAPTAIN, role: 0 as const }, { userId: FO, role: 1 as const }] };
    const value = input({ desired, previous: { ...desired, crewPending: true }, remoteId: REMOTE_ID, schedules: [schedule(desired, [{ userId: CAPTAIN, role: 0 }])], api: apiFor(desired) });
    await synchronizeIfFlight(value); expect(value.api.create).not.toHaveBeenCalled(); expect(value.api.putCrew).toHaveBeenCalledWith(REMOTE_ID, { userId: FO, role: 1 });
  });
  it("detects unexpected external crew, even during a partial publish", async () => {
    const value = input({ previous: { ...authored(), crewPending: true }, schedules: [schedule(authored(), [{ userId: FO, role: 1 }])] });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict" });
  });
  it("resumes a failed removal using previously authored crew while protecting external crew", async () => {
    const old = { ...authored(), crew: [{ userId: CAPTAIN, role: 0 as const }, { userId: FO, role: 1 as const }] };
    const first = input({ previous: old, remoteId: REMOTE_ID, schedules: [schedule(old)], api: apiFor(old) });
    vi.mocked(first.api.removeCrew).mockRejectedValue(new IfLiveError("temporary failure", "unavailable", 502));
    await expect(synchronizeIfFlight(first)).rejects.toThrow("temporary failure");
    const transitional = vi.mocked(first.checkpoint).mock.calls.at(-1)![1];
    expect(transitional.previousCrew).toEqual(expect.arrayContaining([{ userId: FO, role: 1 }]));
    const retry = input({ previous: transitional, remoteId: REMOTE_ID, schedules: [schedule(old)], api: apiFor(old) });
    await synchronizeIfFlight(retry); expect(retry.api.create).not.toHaveBeenCalled(); expect(retry.api.removeCrew).toHaveBeenCalledWith(REMOTE_ID, FO);
  });
  it("propagates an uncertain create without trying it again", async () => {
    const value = input(); vi.mocked(value.api.create).mockRejectedValue(new IfLiveError("unknown outcome", "unavailable", 502, 60, true));
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ uncertainWrite: true }); expect(value.api.create).toHaveBeenCalledOnce(); expect(value.checkpoint).not.toHaveBeenCalled();
  });
});
