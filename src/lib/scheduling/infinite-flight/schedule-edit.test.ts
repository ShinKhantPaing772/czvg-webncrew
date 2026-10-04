import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aircraft: { findByPk: vi.fn(), update: vi.fn() }, connection: { findByPk: vi.fn(), update: vi.fn() },
  flights: { findAll: vi.fn(), update: vi.fn() }, events: { create: vi.fn() },
  pilot: { findByPk: vi.fn() }, permission: { findAll: vi.fn() }, query: vi.fn(), transaction: vi.fn(),
  authorization: vi.fn(), fleet: vi.fn(), schedules: vi.fn(), update: vi.fn(),
}));
vi.mock("@/lib/database", () => ({ default: { query: mocks.query, transaction: mocks.transaction } }));
vi.mock("@/lib/models", () => ({ models: { Pilot: mocks.pilot, Permission: mocks.permission } }));
vi.mock("@/lib/scheduling/models", () => ({ LiveAircraft: mocks.aircraft, IfLiveConnection: mocks.connection, LiveFlight: mocks.flights, LiveScheduleEvent: mocks.events }));
vi.mock("./connection", () => ({ getIfAuthorizationSnapshot: mocks.authorization }));
vi.mock("./client", () => ({ getIfFleet: mocks.fleet, getIfSchedules: mocks.schedules, updateIfSchedule: mocks.update }));

import { editIfAircraftSchedule } from "./schedule-edit";
import { ifScheduleFingerprint } from "./schedule-view";
import { IfLiveError } from "./config";
import type { IfSchedule } from "./types";

const ORG = "10000000-0000-0000-0000-000000000001";
const AIRCRAFT = "10000000-0000-0000-0000-000000000002";
const SCHEDULE = "10000000-0000-0000-0000-000000000003";
const OTHER = "10000000-0000-0000-0000-000000000004";
const aircraft = { id: 7, active: true, aircraft_id: 10, if_aircraft_id: AIRCRAFT };
const connection = { state: "connected", connected_by: 42, organization_id: ORG, access_token_encrypted: "encrypted-token" };
const remote: IfSchedule = { id: SCHEDULE, aircraftId: AIRCRAFT, organizationId: ORG, callsign: "IF1", flightType: 1, originIcao: "CYYZ", destinationIcao: "CYVR",
  scheduledDepartureUtc: "2026-10-06T10:00:00Z", scheduledArrivalUtc: "2026-10-06T15:00:00Z", briefing: "Preserve private briefing", flightPlan: "Preserve private plan", status: 1, crew: [{ userId: OTHER, role: 0 }], sequence: 3 };
let rowTransactions = 0;
const lockTransaction = { LOCK: { UPDATE: "UPDATE" }, commit: vi.fn() };
const input = (row = remote, changes: Record<string, unknown> = { callsign: "IF2" }) => ({ aircraftId: 7, scheduleId: row.id, expectedFingerprint: ifScheduleFingerprint(row), changes });
const run = async (body: unknown = input()) => editIfAircraftSchedule(99, body);

beforeEach(() => {
  vi.resetAllMocks(); rowTransactions = 0;
  vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "true"); vi.stubEnv("IF_LIVE_AUTO_PUBLISH_ENABLED", "false"); vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "true");
  vi.stubEnv("IF_LIVE_CLIENT_ID", "client"); vi.stubEnv("IF_LIVE_CLIENT_SECRET", "private-secret"); vi.stubEnv("IF_LIVE_REVOCATION_URL", "");
  vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://example.com/oauth/callback"); vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  mocks.transaction.mockImplementation(async work => {
    if (typeof work !== "function") return lockTransaction;
    rowTransactions += 1;
    try { return await work(lockTransaction); } finally { rowTransactions -= 1; }
  });
  mocks.query.mockImplementation(async sql => sql.includes("GET_LOCK") ? [{ acquired: 1 }] : sql.includes("FOR UPDATE") ? [{ name: "live_scheduling_mutex" }] : []);
  mocks.aircraft.findByPk.mockResolvedValue({ ...aircraft }); mocks.connection.findByPk.mockResolvedValue({ ...connection });
  mocks.pilot.findByPk.mockResolvedValue({ status: 1 }); mocks.permission.findAll.mockResolvedValue([{ name: "scheduling" }]);
  mocks.flights.findAll.mockResolvedValue([]);
  mocks.authorization.mockResolvedValue({ token: "private-token", credential: "encrypted-token", owner: 42, organizationId: ORG });
  mocks.fleet.mockResolvedValue([{ id: AIRCRAFT, organizationId: ORG }]); mocks.schedules.mockResolvedValue([remote]);
  mocks.update.mockImplementation(async (_token, _aircraft, _schedule, body) => {
    expect(rowTransactions).toBe(0);
    return { ...remote, ...body, updatedAt: "2026-10-04T15:00:00Z" };
  });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("explicit admin IF schedule edits", () => {
  it.each(Array.from({ length: 13 }, (_, flightType) => flightType))("accepts an official IF type %s while preserving crew, plan and briefing", async flightType => {
    const result = await run(input(remote, { flightType }));
    expect(result.schedule).toMatchObject({ flightType, editable: true });
    expect(mocks.update).toHaveBeenCalledWith("private-token", AIRCRAFT, SCHEDULE, expect.objectContaining({ flightType,
      callsign: remote.callsign, briefing: remote.briefing, flightPlan: remote.flightPlan }));
    expect(mocks.events.create).toHaveBeenCalledWith(expect.objectContaining({ details: { schedule_id: SCHEDULE, changes: { flightType } } }), expect.anything());
  });
  it.each([-1, 13, 1.5, NaN, Infinity, "3", null, {}, undefined])("rejects invalid IF flight type %j before any IF operation", async flightType => {
    await expect(run(input(remote, { flightType }))).rejects.toMatchObject({ code: "validation", status: 400 });
    expect(mocks.authorization).not.toHaveBeenCalled(); expect(mocks.query).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("detects another application's flight type change through the fresh fingerprint", async () => {
    mocks.schedules.mockResolvedValue([{ ...remote, flightType: 3 }]);
    await expect(run(input(remote, { flightType: 12 }))).rejects.toMatchObject({ code: "conflict" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not claim success when IF did not retain the selected flight type", async () => {
    mocks.update.mockResolvedValue(remote);
    await expect(run(input(remote, { flightType: 3 }))).rejects.toMatchObject({ code: "reconciliation", uncertainWrite: true });
    expect(mocks.events.create).not.toHaveBeenCalled();
  });
  it("edits an external unfinished flight with fresh ownership checks, preserving provider briefing, plan, category and crew", async () => {
    const result = await run();
    expect(result.schedule).toMatchObject({ id: SCHEDULE, callsign: "IF2", sequence: 3, editable: true, managedFlightId: null });
    expect(mocks.fleet).toHaveBeenCalledWith("private-token", ORG, { fresh: true });
    expect(mocks.schedules).toHaveBeenCalledWith("private-token", AIRCRAFT, { fresh: true });
    expect(mocks.update).toHaveBeenCalledOnce(); expect(mocks.update).toHaveBeenCalledWith("private-token", AIRCRAFT, SCHEDULE,
      expect.objectContaining({ callsign: "IF2", flightType: 1, briefing: remote.briefing, flightPlan: remote.flightPlan }));
    expect(mocks.query).toHaveBeenCalledWith("SELECT GET_LOCK(:lockName, 0) AS acquired", expect.objectContaining({ replacements: { lockName: "wnc_if_aircraft_7" }, transaction: lockTransaction }));
    expect(mocks.query).toHaveBeenLastCalledWith("SELECT RELEASE_LOCK(:lockName)", expect.objectContaining({ replacements: { lockName: "wnc_if_aircraft_7" } }));
    expect(lockTransaction.commit).toHaveBeenCalledOnce();
    expect(mocks.events.create).toHaveBeenCalledWith({ live_aircraft_id: 7, flight_id: null, actor_id: 99, action: "if_schedule_edited", details: { schedule_id: SCHEDULE, changes: { callsign: "IF2" } } }, expect.anything());
    expect(mocks.aircraft.update).not.toHaveBeenCalled(); expect(mocks.flights.update).not.toHaveBeenCalled(); expect(mocks.connection.update).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/private|briefing|flightPlan|organizationId|aircraftId/);
  });
  it.each([1, 2, 3, 4, 6, 7, 8, 10])("allows an unfinished IF state %s without changing the state", async status => {
    const row = { ...remote, status }; mocks.schedules.mockResolvedValue([row]); mocks.update.mockImplementation(async (_token, _aircraft, _schedule, body) => ({ ...row, ...body }));
    await expect(run(input(row))).resolves.toMatchObject({ schedule: { status, editable: true } });
    expect(mocks.update.mock.calls[0][3]).not.toHaveProperty("status");
  });
  it.each([0, 9, 11])("locks unknown or terminal IF status %s on the server", async status => {
    const row = { ...remote, status }; mocks.schedules.mockResolvedValue([row]);
    await expect(run(input(row))).rejects.toMatchObject({ code: "locked", status: 409 }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("locks actual arrival even when the provider reports scheduled status", async () => {
    const row = { ...remote, actualArrivalUtc: "2026-10-06T15:00:00Z" }; mocks.schedules.mockResolvedValue([row]);
    await expect(run(input(row))).rejects.toMatchObject({ code: "locked", message: "Arrived flights are locked" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([
    { id: 23, public_id: OTHER, if_schedule_id: SCHEDULE, status: "approved" },
    { id: 23, public_id: OTHER, if_schedule_id: SCHEDULE, status: "completed" },
  ])("rejects direct edits to an app-managed local flight %j", async local => {
    mocks.flights.findAll.mockResolvedValue([local]);
    await expect(run()).rejects.toMatchObject({ code: "managed_schedule", status: 409 }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("refuses orphaned app markers instead of detaching the publishing checkpoint", async () => {
    const row = { ...remote, briefing: `[WNC schedule:${OTHER}]` }; mocks.schedules.mockResolvedValue([row]);
    await expect(run(input(row))).rejects.toMatchObject({ code: "managed_schedule" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("preserves an untimed flight by omitting timestamps, without writing invented year-one or null dates", async () => {
    const row = { ...remote, scheduledDepartureUtc: "0001-01-01T00:00:00Z", scheduledArrivalUtc: "0001-01-01T00:00:00Z" }; mocks.schedules.mockResolvedValue([row]);
    mocks.update.mockImplementation(async (_token, _aircraft, _schedule, body) => ({ ...row, ...body }));
    await expect(run(input(row))).resolves.toMatchObject({ schedule: { scheduledDepartureUtc: null, scheduledArrivalUtc: null } });
    expect(mocks.update.mock.calls[0][3]).not.toHaveProperty("scheduledDepartureUtc"); expect(mocks.update.mock.calls[0][3]).not.toHaveProperty("scheduledArrivalUtc");
    await expect(run(input(row, { callsign: "IF2", scheduledDepartureUtc: "2026-10-06T12:00:00+02:00", scheduledArrivalUtc: "2026-10-06T15:00:00Z" }))).resolves.toMatchObject({ schedule: { scheduledDepartureUtc: "2026-10-06T10:00:00.000Z" } });
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });
  it("clears an existing time pair only when IF confirms the omission produced an untimed result", async () => {
    mocks.update.mockImplementation(async (_token, _aircraft, _schedule, body) => ({ ...remote, ...body, scheduledDepartureUtc: "0001-01-01T00:00:00Z", scheduledArrivalUtc: "0001-01-01T00:00:00Z" }));
    await expect(run(input(remote, { scheduledDepartureUtc: null, scheduledArrivalUtc: null }))).resolves.toMatchObject({ schedule: { scheduledDepartureUtc: null, scheduledArrivalUtc: null } });
    expect(mocks.update.mock.calls[0][3]).not.toHaveProperty("scheduledDepartureUtc");
    expect(mocks.events.create).toHaveBeenCalledWith(expect.objectContaining({ details: { schedule_id: SCHEDULE, changes: { scheduledDepartureUtc: null, scheduledArrivalUtc: null } } }), expect.anything());
  });
  it("reports an upstream rejection of unset times without a successful edit or automatic retry", async () => {
    mocks.update.mockRejectedValue(new IfLiveError("IF rejected the operation (error 10)", "upstream_rejected", 400));
    await expect(run(input(remote, { scheduledDepartureUtc: null, scheduledArrivalUtc: null }))).rejects.toMatchObject({ code: "upstream_rejected", status: 400 });
    expect(mocks.update).toHaveBeenCalledOnce(); expect(mocks.events.create).not.toHaveBeenCalled();
  });
  it.each([
    { aircraftId: 0 }, { aircraftId: 2_147_483_648 }, { scheduleId: "invalid" }, { expectedFingerprint: "invalid" }, { actorId: 1 },
    { changes: {} }, { changes: { crew: [] } }, { changes: { callsign: "" } }, { changes: { callsign: "x\n" } },
    { changes: { originIcao: "../../../" } }, { changes: { scheduledDepartureUtc: null } }, { changes: { scheduledDepartureUtc: "0001-01-01T00:00:00Z" } },
  ])("rejects invalid input before touching IF or acquiring locks: %j", changes => {
    return expect(run({ ...input(), ...changes })).rejects.toMatchObject({ code: "validation", status: 400 }).then(() => {
      expect(mocks.authorization).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.query).not.toHaveBeenCalled();
    });
  });
  it("blocks concurrent provider edits from a stale optimistic fingerprint", async () => {
    mocks.schedules.mockResolvedValue([{ ...remote, callsign: "Someone changed this" }]);
    await expect(run()).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("changed after") }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("checks exact ownership and refuses foreign or duplicated fleet membership", async () => {
    mocks.fleet.mockResolvedValue([{ id: AIRCRAFT, organizationId: OTHER }]);
    await expect(run()).rejects.toMatchObject({ code: "binding" }); expect(mocks.schedules).not.toHaveBeenCalled();
    mocks.fleet.mockResolvedValue([{ id: AIRCRAFT, organizationId: ORG }, { id: AIRCRAFT, organizationId: ORG }]);
    await expect(run()).rejects.toMatchObject({ code: "binding" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([{ aircraftId: OTHER }, { organizationId: OTHER }])("refuses a foreign IF schedule response %j", changes => {
    mocks.schedules.mockResolvedValue([{ ...remote, ...changes }]);
    return expect(run()).rejects.toMatchObject({ code: "invalid_response" }).then(() => expect(mocks.update).not.toHaveBeenCalled());
  });
  it("fails closed when a publisher or another editor holds the aircraft advisory lock", async () => {
    mocks.query.mockResolvedValue([{ acquired: 0 }]);
    await expect(run()).rejects.toMatchObject({ code: "conflict" }); expect(mocks.authorization).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
    expect(lockTransaction.commit).toHaveBeenCalledOnce();
  });
  it.each([null, { ...aircraft, active: false }, { ...aircraft, if_aircraft_id: OTHER }, { ...aircraft, aircraft_id: 11 }])("rechecks a changed binding before PUT %j", current => {
    mocks.aircraft.findByPk.mockResolvedValueOnce(aircraft).mockResolvedValue(current);
    return expect(run()).rejects.toMatchObject({ code: "connection_changed" }).then(() => expect(mocks.update).not.toHaveBeenCalled());
  });
  it.each([{ ...connection, state: "disconnected" }, { ...connection, organization_id: OTHER }, { ...connection, connected_by: 43 }, { ...connection, access_token_encrypted: "new" }])("rechecks shared authorization before PUT %j", current => {
    mocks.connection.findByPk.mockResolvedValue(current);
    return expect(run()).rejects.toMatchObject({ code: "connection_changed" }).then(() => expect(mocks.update).not.toHaveBeenCalled());
  });
  it("rechecks actor and connecting administrator access under the mutation mutex", async () => {
    mocks.permission.findAll.mockResolvedValue([]);
    await expect(run()).rejects.toMatchObject({ code: "forbidden", status: 403 }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("refuses changing the itinerary of an in-progress local aircraft", async () => {
    mocks.flights.findAll.mockResolvedValue([{ status: "in_progress" }]);
    await expect(run()).rejects.toMatchObject({ code: "conflict" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("validates downstream airport continuity before writing a route amendment", async () => {
    mocks.schedules.mockResolvedValue([remote, { ...remote, id: OTHER, originIcao: "CYVR", destinationIcao: "KSEA", scheduledDepartureUtc: "2026-10-06T16:00:00Z", scheduledArrivalUtc: "2026-10-06T17:00:00Z" }]);
    await expect(run(input(remote, { destinationIcao: "KLAX" }))).rejects.toMatchObject({ code: "conflict" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("does not retry an uncertain PUT and tells the administrator to reconcile the refreshed schedule", async () => {
    mocks.update.mockRejectedValue(new IfLiveError("Timeout", "unavailable", 502, 60, true));
    await expect(run()).rejects.toMatchObject({ code: "reconciliation", uncertainWrite: true, message: expect.stringContaining("Refresh schedules") });
    expect(mocks.update).toHaveBeenCalledOnce(); expect(mocks.events.create).not.toHaveBeenCalled(); expect(lockTransaction.commit).toHaveBeenCalledOnce();
  });
  it.each([{ id: OTHER }, { crew: [] }, { callsign: "Unexpected" }])("does not claim success for a mismatched PUT result %j", changes => {
    mocks.update.mockResolvedValue({ ...remote, callsign: "IF2", ...changes });
    return expect(run()).rejects.toMatchObject({ code: "reconciliation", uncertainWrite: true }).then(() => expect(mocks.events.create).not.toHaveBeenCalled());
  });
});
