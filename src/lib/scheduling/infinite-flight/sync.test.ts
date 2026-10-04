import { describe, expect, it, vi } from "vitest";
import { IfLiveError } from "./config";
import { buildIfPayload, scheduleMarker, synchronizeIfFlight, type SyncApi } from "./sync";
import type { AuthoredIfPayload, IfSchedule } from "./types";
import type { FlightType } from "../flight-types";

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
function expectNoWrites(value: ReturnType<typeof input>) {
  expect(value.api.create).not.toHaveBeenCalled(); expect(value.api.update).not.toHaveBeenCalled(); expect(value.api.remove).not.toHaveBeenCalled();
  expect(value.api.putCrew).not.toHaveBeenCalled(); expect(value.api.removeCrew).not.toHaveBeenCalled(); expect(value.checkpoint).not.toHaveBeenCalled();
}

describe("IF reconciliation", () => {
  it.each([
    ["commercial", 1], ["freight", 3], ["ferry", 12], ["charter", 2], ["training", 4], ["test_flight", 5],
    ["medical_emergency", 6], ["military", 7], ["vip_executive", 8], ["humanitarian_relief", 9],
    ["general_aviation", 10], ["airshow", 11], ["other", 12],
  ] as const)("maps the local %s category to the official IF flight type %s", (flightType, ifType) => {
    const value = buildIfPayload({ ...flight, flight_type: flightType }, [{ userId: CAPTAIN, role: 0 }]);
    expect(value.schedule.flightType).toBe(ifType);
    expect(value.schedule.briefing).toContain(flight.notes);
    expect(value.schedule.briefing).toContain(scheduleMarker(PUBLIC_ID));
    if (flightType === "ferry") expect(value.schedule.briefing).toContain("Flight type: Ferry");
    else expect(value.schedule.briefing).not.toContain("Flight type: Ferry");
  });
  it.each([undefined, null])("keeps legacy flights without a flight type commercial: %s", flightType => {
    expect(buildIfPayload({ ...flight, flight_type: flightType }, [{ userId: CAPTAIN, role: 0 }]).schedule.flightType).toBe(1);
  });
  it("rejects an unsupported stored flight type with a sanitized validation error", () => {
    expect(() => buildIfPayload({ ...flight, flight_type: "provider-private-value" as FlightType }, [{ userId: CAPTAIN, role: 0 }]))
      .toThrowError(new IfLiveError("The local flight has an unsupported flight type; amend it before publishing", "validation", 409));
  });
  it("requires a local type amendment to update the corresponding owned IF schedule", async () => {
    const previous = authored();
    const desired = buildIfPayload({ ...flight, flight_type: "freight" }, previous.crew);
    const value = input({ remoteId: REMOTE_ID, previous, desired, schedules: [schedule()], api: apiFor(desired) });
    await synchronizeIfFlight(value);
    expect(value.api.update).toHaveBeenCalledWith(REMOTE_ID, expect.objectContaining({ flightType: 3 }));
  });
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
      { ...schedule(), id: FO, briefing: "Previous booking", originIcao: "KBOS", destinationIcao: "CYYZ", scheduledDepartureUtc: "2026-10-04T08:00:00Z", scheduledArrivalUtc: "2026-10-04T10:00:00Z" },
      { ...schedule(), id: CAPTAIN, briefing: "Cancelled", status: 9 }, { ...schedule(), id: PUBLIC_ID, briefing: "Arrived", status: 11 },
    ] });
    await synchronizeIfFlight(value); expect(value.api.create).toHaveBeenCalledOnce();
  });
  it.each(["sync", "overwrite", "recreate"] as const)("rejects a non-overlapping foreign predecessor that leaves the aircraft at the wrong airport during %s", async action => {
    const external = { ...schedule(), id: FO, briefing: "External booking", destinationIcao: "KJFK", scheduledDepartureUtc: "2026-10-04T05:00:00Z", scheduledArrivalUtc: "2026-10-04T09:00:00Z" };
    const value = input({ schedules: [external], action });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("discontinuous") });
    expectNoWrites(value);
  });
  it("rejects a successor departing from the wrong airport before changing an owned reservation", async () => {
    const external = { ...schedule(), id: FO, briefing: "External booking", originIcao: "KJFK", destinationIcao: "KLAX", scheduledDepartureUtc: "2026-10-04T16:00:00Z", scheduledArrivalUtc: "2026-10-04T21:00:00Z" };
    const desired = { ...authored(), schedule: { ...authored().schedule, callsign: "CHANGED" } };
    const value = input({ remoteId: REMOTE_ID, previous: authored(), desired, schedules: [schedule(), external] });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("discontinuous") });
    expectNoWrites(value);
  });
  it("checks the amended route rather than the previously published route", async () => {
    const next = { ...schedule(), id: FO, briefing: "External booking", originIcao: "CYVR", destinationIcao: "KLAX", scheduledDepartureUtc: "2026-10-04T16:00:00Z", scheduledArrivalUtc: "2026-10-04T21:00:00Z" };
    const desired = { ...authored(), schedule: { ...authored().schedule, destinationIcao: "KJFK" } };
    const value = input({ remoteId: REMOTE_ID, previous: authored(), desired, schedules: [schedule(), next] });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("discontinuous") });
    expectNoWrites(value);
  });
  it("keeps an unpublished local successor in the combined route", async () => {
    const next = { ...flight, public_id: FO, departure: "CYVR", arrival: "KJFK", scheduled_departure: new Date("2026-10-04T16:00:00Z"), scheduled_arrival: new Date("2026-10-04T18:00:00Z") };
    const external = { ...schedule(), id: CAPTAIN, briefing: "Later external booking", originIcao: "KJFK", destinationIcao: "KBOS", scheduledDepartureUtc: "2026-10-04T19:00:00Z", scheduledArrivalUtc: "2026-10-04T21:00:00Z" };
    const value = input({ remoteId: REMOTE_ID, previous: authored(), schedules: [schedule(), external], localFlights: [flight, next] });
    await synchronizeIfFlight(value); expect(value.api.create).not.toHaveBeenCalled(); expect(value.api.update).not.toHaveBeenCalled();
  });
  it("waits for an unpublished earlier local bridge before publishing its successor", async () => {
    const earlier = { ...flight, public_id: FO, departure: "KJFK", arrival: "CYYZ", scheduled_departure: new Date("2026-10-04T08:00:00Z"), scheduled_arrival: new Date("2026-10-04T10:00:00Z") };
    const external = { ...schedule(), id: CAPTAIN, briefing: "External predecessor", destinationIcao: "KJFK", scheduledDepartureUtc: "2026-10-04T05:00:00Z", scheduledArrivalUtc: "2026-10-04T07:00:00Z" };
    const value = input({ schedules: [external], localFlights: [earlier, flight] });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "predecessor_pending" }); expectNoWrites(value);
  });
  it("waits for an earlier local amendment to publish even when its old IF route remains compatible", async () => {
    const earlier = { ...flight, public_id: FO, departure: "KJFK", arrival: "CYYZ", scheduled_departure: new Date("2026-10-04T08:00:00Z"), scheduled_arrival: new Date("2026-10-04T10:00:00Z"), revision: 2, published_revision: 1 };
    const remote = { ...schedule(), id: CAPTAIN, briefing: scheduleMarker(FO), originIcao: "KJFK", destinationIcao: "CYYZ", scheduledDepartureUtc: "2026-10-04T08:00:00Z", scheduledArrivalUtc: "2026-10-04T10:00:00Z" };
    const value = input({ schedules: [remote], localFlights: [earlier, flight] });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "predecessor_pending" }); expectNoWrites(value);
  });
  it("does not substitute local routes for an externally edited managed predecessor", async () => {
    const earlier = { ...flight, public_id: FO, departure: "KJFK", arrival: "CYYZ", scheduled_departure: new Date("2026-10-04T08:00:00Z"), scheduled_arrival: new Date("2026-10-04T10:00:00Z") };
    const expected = buildIfPayload(earlier, authored().crew);
    const value = input({ schedules: [{ ...schedule(expected), id: CAPTAIN, destinationIcao: "CYVR" }], localFlights: [{ ...earlier, last_published_payload: expected }, flight] });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("changed outside this app") }); expectNoWrites(value);
  });
  it("rejects creating before a foreign future reservation rather than leaving a wrongly appended reservation", async () => {
    const value = input({ schedules: [{ ...schedule(), id: FO, briefing: "External successor", originIcao: "CYVR", destinationIcao: "KJFK", scheduledDepartureUtc: "2026-10-04T16:00:00Z", scheduledArrivalUtc: "2026-10-04T18:00:00Z" }] });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("wrong side") }); expectNoWrites(value);
  });
  it("allows an appended first local leg when the published local successor can be reordered safely", async () => {
    const next = { ...flight, public_id: FO, departure: "CYVR", arrival: "KJFK", scheduled_departure: new Date("2026-10-04T16:00:00Z"), scheduled_arrival: new Date("2026-10-04T18:00:00Z") };
    const remote = { ...schedule(buildIfPayload(next, authored().crew)), id: CAPTAIN };
    const value = input({ schedules: [remote], localFlights: [flight, next] });
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
  it.each([9, 11])("reconciles an unchanged owned terminal reservation in state %s without deleting history", async status => {
    const value = input({ remoteId: REMOTE_ID, schedules: [{ ...schedule(), status }], previous: authored(), desired: null, uncertainCreation: true });
    await expect(synchronizeIfFlight(value)).resolves.toEqual({ remoteId: null, removed: true }); expectNoWrites(value);
  });
  it.each([9, 11])("protects terminal state %s against unrelated changes even with overwrite selected", async status => {
    const value = input({ remoteId: REMOTE_ID, schedules: [{ ...schedule(), status, destinationIcao: "KJFK" }], previous: authored(), desired: null, action: "overwrite" });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict" }); expectNoWrites(value);
  });
  it.each([0, 6, 99])("blocks cancellation of owned started or unknown state %s", async status => {
    const value = input({ remoteId: REMOTE_ID, schedules: [{ ...schedule(), status }], previous: authored(), desired: null });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict" }); expectNoWrites(value);
  });
  it.each([9, 11])("never relinks or deletes a foreign terminal reservation in state %s", async status => {
    const value = input({ remoteId: REMOTE_ID, schedules: [{ ...schedule(), status, briefing: "Foreign reservation" }], previous: authored(), desired: null, action: "overwrite" });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict" }); expectNoWrites(value);
  });
  it("does not delete a changed scheduled reservation even with overwrite selected", async () => {
    const value = input({ remoteId: REMOTE_ID, schedules: [{ ...schedule(), destinationIcao: "KJFK" }], previous: authored(), desired: null, action: "overwrite" });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict" }); expectNoWrites(value);
  });
  it("does not remove a bridge between remaining active IF flights", async () => {
    const earlier = { ...schedule(), id: CAPTAIN, briefing: "Earlier external flight", originIcao: "KBOS", destinationIcao: "CYYZ", scheduledDepartureUtc: "2026-10-04T05:00:00Z", scheduledArrivalUtc: "2026-10-04T09:00:00Z" };
    const later = { ...schedule(), id: FO, briefing: "Later external flight", originIcao: "CYVR", destinationIcao: "KJFK", scheduledDepartureUtc: "2026-10-04T16:00:00Z", scheduledArrivalUtc: "2026-10-04T18:00:00Z" };
    const value = input({ remoteId: REMOTE_ID, schedules: [earlier, schedule(), later], previous: authored(), desired: null });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("discontinuous") }); expectNoWrites(value);
  });
  it("drains a cancellation cascade downstream first without stranding the predecessor job in conflict", async () => {
    const nextFlight = { ...flight, id: 10, public_id: FO, departure: "CYVR", arrival: "KJFK", scheduled_departure: new Date("2026-10-04T16:00:00Z"), scheduled_arrival: new Date("2026-10-04T18:00:00Z") };
    const nextPayload = buildIfPayload(nextFlight, authored().crew); const next = { ...schedule(nextPayload), id: CAPTAIN };
    const localFlights = [{ ...flight, status: "cancelled", if_schedule_id: REMOTE_ID, last_published_payload: authored() }, { ...nextFlight, status: "needs_review", if_schedule_id: CAPTAIN, last_published_payload: nextPayload }];
    const blocked = input({ remoteId: REMOTE_ID, schedules: [schedule(), next], previous: authored(), desired: null, localFlights });
    await expect(synchronizeIfFlight(blocked)).rejects.toMatchObject({ code: "removal_pending" }); expectNoWrites(blocked);
    const downstream = input({ publicId: FO, remoteId: CAPTAIN, schedules: [schedule(), next], previous: nextPayload, desired: null, localFlights });
    await expect(synchronizeIfFlight(downstream)).resolves.toEqual({ remoteId: null, removed: true }); expect(downstream.api.remove).toHaveBeenCalledWith(CAPTAIN);
    const retry = input({ remoteId: REMOTE_ID, schedules: [schedule()], previous: authored(), desired: null, localFlights });
    await expect(synchronizeIfFlight(retry)).resolves.toEqual({ remoteId: null, removed: true }); expect(retry.api.remove).toHaveBeenCalledWith(REMOTE_ID);
  });
  it("waits for downstream cleanup before publishing an amendment that changes the preceding route", async () => {
    const nextFlight = { ...flight, id: 10, public_id: FO, departure: "CYVR", arrival: "KJFK", scheduled_departure: new Date("2026-10-04T16:00:00Z"), scheduled_arrival: new Date("2026-10-04T18:00:00Z") };
    const nextPayload = buildIfPayload(nextFlight, authored().crew); const next = { ...schedule(nextPayload), id: CAPTAIN };
    const desired = { ...authored(), schedule: { ...authored().schedule, destinationIcao: "KLAX" } };
    const localFlights = [{ ...flight, arrival: "KLAX", status: "approved", if_schedule_id: REMOTE_ID, last_published_payload: authored() }, { ...nextFlight, status: "needs_review", if_schedule_id: CAPTAIN, last_published_payload: nextPayload }];
    const blocked = input({ remoteId: REMOTE_ID, schedules: [schedule(), next], previous: authored(), desired, localFlights });
    await expect(synchronizeIfFlight(blocked)).rejects.toMatchObject({ code: "removal_pending" }); expectNoWrites(blocked);
    const downstream = input({ publicId: FO, remoteId: CAPTAIN, schedules: [schedule(), next], previous: nextPayload, desired: null, localFlights });
    await synchronizeIfFlight(downstream); expect(downstream.api.remove).toHaveBeenCalledWith(CAPTAIN);
    const retry = input({ remoteId: REMOTE_ID, schedules: [schedule()], previous: authored(), desired, localFlights });
    await synchronizeIfFlight(retry); expect(retry.api.update).toHaveBeenCalledWith(REMOTE_ID, desired.schedule);
  });
  it("keeps an externally changed pending removal in conflict", async () => {
    const nextFlight = { ...flight, id: 10, public_id: FO, departure: "CYVR", arrival: "KJFK", scheduled_departure: new Date("2026-10-04T16:00:00Z"), scheduled_arrival: new Date("2026-10-04T18:00:00Z") };
    const nextPayload = buildIfPayload(nextFlight, authored().crew);
    const value = input({ remoteId: REMOTE_ID, schedules: [schedule(), { ...schedule(nextPayload), id: CAPTAIN, destinationIcao: "KLAX" }], previous: authored(), desired: null,
      localFlights: [{ ...flight, status: "cancelled", last_published_payload: authored() }, { ...nextFlight, status: "needs_review", if_schedule_id: CAPTAIN, last_published_payload: nextPayload }] });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("changed outside this app") }); expectNoWrites(value);
  });
  it("does not project away a pending removal whose ownership marker was removed", async () => {
    const nextFlight = { ...flight, id: 10, public_id: FO, departure: "CYVR", arrival: "KJFK", scheduled_departure: new Date("2026-10-04T16:00:00Z"), scheduled_arrival: new Date("2026-10-04T18:00:00Z") };
    const nextPayload = buildIfPayload(nextFlight, authored().crew);
    const value = input({ remoteId: REMOTE_ID, schedules: [schedule(), { ...schedule(nextPayload), id: CAPTAIN, briefing: "External reservation" }], previous: authored(), desired: null,
      localFlights: [{ ...flight, status: "cancelled", last_published_payload: authored() }, { ...nextFlight, status: "needs_review", if_schedule_id: CAPTAIN, last_published_payload: nextPayload }] });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("lost this app's reference") }); expectNoWrites(value);
  });
  it("never removes a first leg that would strand a foreign successor", async () => {
    const external = { ...schedule(), id: FO, briefing: "External successor", originIcao: "CYVR", destinationIcao: "KJFK", scheduledDepartureUtc: "2026-10-04T16:00:00Z", scheduledArrivalUtc: "2026-10-04T18:00:00Z" };
    const value = input({ remoteId: REMOTE_ID, schedules: [schedule(), external], previous: authored(), desired: null });
    await expect(synchronizeIfFlight(value)).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("leave the aircraft at CYYZ") }); expectNoWrites(value);
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
