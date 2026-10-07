import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aircraft: { findByPk: vi.fn() }, connection: { findByPk: vi.fn() },
  flights: { findByPk: vi.fn(), findAll: vi.fn(), findOne: vi.fn() }, members: { findAll: vi.fn() },
  outbox: { findOne: vi.fn(), create: vi.fn(), update: vi.fn() }, events: { create: vi.fn() },
  pilot: { findByPk: vi.fn() }, catalog: { findByPk: vi.fn() }, permission: { findAll: vi.fn() },
  query: vi.fn(), transaction: vi.fn(), authorization: vi.fn(), binding: vi.fn(), schedules: vi.fn(), update: vi.fn(), access: vi.fn(),
}));
vi.mock("@/lib/database", () => ({ default: { query: mocks.query, transaction: mocks.transaction } }));
vi.mock("@/lib/models", () => ({ models: { Pilot: mocks.pilot, Permission: mocks.permission, Aircraft: mocks.catalog } }));
vi.mock("@/lib/scheduling/models", () => ({ LiveAircraft: mocks.aircraft, IfLiveConnection: mocks.connection, LiveFlight: mocks.flights,
  LiveFlightMember: mocks.members, LiveScheduleEvent: mocks.events, IfLiveOutbox: mocks.outbox }));
vi.mock("@/lib/scheduling/access", () => ({ canAccessLiveScheduling: mocks.access }));
vi.mock("./connection", () => ({ getIfAuthorizationSnapshot: mocks.authorization }));
vi.mock("./binding", () => ({ validateIfAircraftBinding: mocks.binding }));
vi.mock("./client", () => ({ getIfSchedules: mocks.schedules, updateIfSchedule: mocks.update }));

import { matchIfAircraftSchedule } from "./schedule-match";
import { IfLiveError } from "./config";
import { ifScheduleFingerprint } from "./schedule-view";
import { buildIfPayload } from "./sync";
import type { IfSchedule } from "./types";

const ORG = "10000000-0000-0000-0000-000000000001";
const AIRCRAFT = "10000000-0000-0000-0000-000000000002";
const SCHEDULE = "10000000-0000-0000-0000-000000000003";
const CAPTAIN = "10000000-0000-0000-0000-000000000004";
const CREW = "10000000-0000-0000-0000-000000000005";
const PUBLIC = "10000000-0000-0000-0000-000000000006";
const OTHER = "10000000-0000-0000-0000-000000000007";
const aircraft = { id: 7, active: true, aircraft_id: 10, if_aircraft_id: AIRCRAFT };
const connection = { state: "connected", connected_by: 42, organization_id: ORG, access_token_encrypted: "encrypted-token" };
const catalog = { id: 10, status: 1, ifaircraftid: AIRCRAFT, ifliveryid: null };
const remote: IfSchedule = { id: SCHEDULE, aircraftId: AIRCRAFT, organizationId: ORG, callsign: "OLD1", flightType: 1,
  originIcao: "CYYZ", destinationIcao: "CYVR", scheduledDepartureUtc: "2026-10-06T10:00:00Z", scheduledArrivalUtc: "2026-10-06T15:00:00Z",
  briefing: "IF private briefing", flightPlan: "IF private plan", status: 1, crew: [{ userId: CAPTAIN, role: 0 }], sequence: 3 };
const baseFlight = { id: 23, public_id: PUBLIC, live_aircraft_id: 7, captain_id: 12, callsign: "CC1", flight_type: "commercial" as const,
  departure: "CYYZ", arrival: "CYVR", scheduled_departure: null, scheduled_arrival: null, status: "approved", queue_order: 1,
  revision: 4, published_revision: 0, if_schedule_id: null as string | null, publishing_state: "conflict", last_published_payload: null as Record<string, unknown> | null, notes: "CC authored notes" };
let flight: Record<string, unknown> & typeof baseFlight;
let rowTransactions = 0;
const lockTransaction = { LOCK: { UPDATE: "UPDATE" }, commit: vi.fn() };
const input = (row = remote) => ({ flightId: 23, scheduleId: row.id, expectedFingerprint: ifScheduleFingerprint(row), expectedRevision: 4 });
const run = async (body: unknown = input()) => matchIfAircraftSchedule(99, body);

beforeEach(() => {
  vi.resetAllMocks(); rowTransactions = 0;
  vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "true"); vi.stubEnv("IF_LIVE_AUTO_PUBLISH_ENABLED", "false"); vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "true");
  vi.stubEnv("IF_LIVE_CLIENT_ID", "client"); vi.stubEnv("IF_LIVE_CLIENT_SECRET", "private-secret"); vi.stubEnv("IF_LIVE_REVOCATION_URL", "");
  vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://example.com/oauth/callback"); vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  flight = { ...baseFlight, update: vi.fn(async values => Object.assign(flight, values)) };
  mocks.transaction.mockImplementation(async work => {
    if (typeof work !== "function") return lockTransaction;
    rowTransactions += 1;
    try { return await work(lockTransaction); } finally { rowTransactions -= 1; }
  });
  mocks.query.mockImplementation(async sql => sql.includes("GET_LOCK") ? [{ acquired: 1 }] : sql.includes("FOR UPDATE") ? [{ name: "live_scheduling_mutex" }] : []);
  mocks.aircraft.findByPk.mockResolvedValue({ ...aircraft }); mocks.connection.findByPk.mockResolvedValue({ ...connection }); mocks.catalog.findByPk.mockResolvedValue({ ...catalog });
  mocks.flights.findByPk.mockImplementation(async () => flight); mocks.flights.findAll.mockImplementation(async () => [flight]); mocks.flights.findOne.mockResolvedValue(null);
  mocks.members.findAll.mockResolvedValue([{ pilot_id: 13 }]); mocks.outbox.findOne.mockResolvedValue(null);
  mocks.pilot.findByPk.mockImplementation(async id => ({ status: 1, ifuserid: id === 12 ? CAPTAIN : CREW }));
  mocks.permission.findAll.mockResolvedValue([{ name: "scheduling" }]); mocks.access.mockResolvedValue(true);
  mocks.authorization.mockResolvedValue({ token: "private-token", credential: "encrypted-token", owner: 42, organizationId: ORG });
  mocks.binding.mockResolvedValue({ id: AIRCRAFT }); mocks.schedules.mockResolvedValue([remote]);
  mocks.update.mockImplementation(async (_token, _aircraft, _schedule, body) => {
    expect(rowTransactions).toBe(0);
    expect(flight).toMatchObject({ if_schedule_id: SCHEDULE, publishing_state: "reconciliation" });
    return { ...remote, ...body, scheduledDepartureUtc: body.scheduledDepartureUtc, scheduledArrivalUtc: body.scheduledArrivalUtc };
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("explicit same-flight IF matching", () => {
  it("adopts the known schedule with authored CC fields, checkpoints before PUT, and queues safe crew sync without persisting fetched responses", async () => {
    await expect(run()).resolves.toEqual({ flightId: 23 });
    const desired = buildIfPayload(baseFlight, [{ userId: CAPTAIN, role: 0 }, { userId: CREW, role: 1 }]);
    expect(mocks.update).toHaveBeenCalledOnce(); expect(mocks.update).toHaveBeenCalledWith("private-token", AIRCRAFT, SCHEDULE, desired.schedule);
    expect(mocks.binding).toHaveBeenCalledWith({ token: "private-token", organizationId: ORG, ifAircraftId: AIRCRAFT, catalog });
    expect(mocks.schedules).toHaveBeenCalledWith("private-token", AIRCRAFT, { fresh: true });
    expect(flight).toMatchObject({ if_schedule_id: SCHEDULE, last_published_payload: { ...desired, crewPending: true }, publishing_state: "queued", published_revision: 0 });
    expect(mocks.outbox.create.mock.calls.map(call => call[0].state)).toEqual(["reconciliation", "queued"]);
    expect(mocks.outbox.create.mock.calls.every(call => call[0].action === "sync")).toBe(true);
    expect(JSON.stringify(flight.last_published_payload)).not.toMatch(/IF private|sequence|updatedAt|organizationId|aircraftId/);
    expect(mocks.events.create).toHaveBeenCalledWith(expect.objectContaining({ actor_id: 99, action: "if_schedule_matched", details: { schedule_id: SCHEDULE, revision: 4 } }), expect.anything());
    expect(mocks.query).toHaveBeenLastCalledWith("SELECT RELEASE_LOCK(:lockName)", expect.objectContaining({ replacements: { lockName: "wnc_if_aircraft_7" } }));
    expect(lockTransaction.commit).toHaveBeenCalledOnce();
  });
  it("updates the existing revision job instead of requiring a second publishing record", async () => {
    const update = vi.fn(); mocks.outbox.findOne.mockImplementation(async options => options.where.revision ? { update } : null);
    await run(); expect(mocks.outbox.create).not.toHaveBeenCalled();
    expect(update.mock.calls.map(call => call[0].state)).toEqual(["reconciliation", "queued"]);
  });
  it("can reconcile an uncertain marker write to the same binding after refreshing the fingerprint", async () => {
    flight.if_schedule_id = SCHEDULE; flight.publishing_state = "reconciliation";
    const row = { ...remote, briefing: `[WNC schedule:${PUBLIC}]` }; mocks.schedules.mockResolvedValue([row]);
    await expect(run(input(row))).resolves.toEqual({ flightId: 23 }); expect(mocks.update).toHaveBeenCalledOnce();
  });
  it("leaves a known binding and authored checkpoint blocked for reconciliation when PUT is uncertain", async () => {
    mocks.update.mockRejectedValue(new IfLiveError("Timed out", "unavailable", 503, 60, true));
    await expect(run()).rejects.toMatchObject({ code: "reconciliation", uncertainWrite: true });
    expect(flight).toMatchObject({ if_schedule_id: SCHEDULE, publishing_state: "reconciliation", last_published_payload: { crewPending: true } });
    expect(mocks.outbox.create).toHaveBeenCalledOnce(); expect(mocks.events.create).not.toHaveBeenCalledWith(expect.objectContaining({ action: "if_schedule_matched" }), expect.anything());
  });
  it("retains reconciliation when IF confirms different fields or altered crew", async () => {
    mocks.update.mockResolvedValue(remote);
    await expect(run()).rejects.toMatchObject({ code: "reconciliation", uncertainWrite: true });
    expect(flight.publishing_state).toBe("reconciliation"); expect(mocks.outbox.create).toHaveBeenCalledOnce();
  });
  it("refuses stale fingerprints without binding or writing", async () => {
    mocks.schedules.mockResolvedValue([{ ...remote, callsign: "External change" }]);
    await expect(run()).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("changed after") });
    expect(mocks.update).not.toHaveBeenCalled(); expect(flight.if_schedule_id).toBeNull();
  });
  it.each([0, 2, 3, 4, 6, 7, 8, 9, 10, 11])("refuses started or terminal IF status %s", async status => {
    const row = { ...remote, status }; mocks.schedules.mockResolvedValue([row]);
    await expect(run(input(row))).rejects.toMatchObject({ code: "locked" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each(["actualDepartureUtc", "actualArrivalUtc"])("locks an actual %s despite scheduled status", async key => {
    const row = { ...remote, [key]: "2026-10-06T10:00:00Z" }; mocks.schedules.mockResolvedValue([row]);
    await expect(run(input(row))).rejects.toMatchObject({ code: "locked" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([{ originIcao: "KJFK" }, { destinationIcao: "KJFK" }, { flightType: 3 }])("rejects mismatched identity %j", async changes => {
    const row = { ...remote, ...changes }; mocks.schedules.mockResolvedValue([row]);
    await expect(run(input(row))).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("route and flight type") }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([{ crew: [{ userId: OTHER, role: 0 as const }] }, { crew: [{ userId: CAPTAIN, role: 1 as const }] }, { crew: [{ userId: CAPTAIN, role: 0 as const }, { userId: OTHER, role: 1 as const }] }])("rejects another captain or unapproved external crew %j", async ({ crew }) => {
    const row = { ...remote, crew }; mocks.schedules.mockResolvedValue([row]);
    await expect(run(input(row))).rejects.toMatchObject({ code: "crew" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("refuses duplicated external crew instead of checkpointing an ambiguous assignment", async () => {
    const row = { ...remote, crew: [remote.crew[0], remote.crew[0]] }; mocks.schedules.mockResolvedValue([row]);
    await expect(run(input(row))).rejects.toMatchObject({ code: "crew" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([OTHER, `${PUBLIC}] [WNC schedule:${PUBLIC}`])("rejects another local marker or duplicated marker %s", async marker => {
    const row = { ...remote, briefing: `[WNC schedule:${marker}]` }; mocks.schedules.mockResolvedValue([row]);
    await expect(run(input(row))).rejects.toMatchObject({ code: "conflict" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects a duplicate copy of the target marker elsewhere in IF", async () => {
    mocks.schedules.mockResolvedValue([remote, { ...remote, id: OTHER, briefing: `[WNC schedule:${PUBLIC}]` }]);
    await expect(run()).rejects.toMatchObject({ code: "conflict" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([{ aircraftId: OTHER }, { organizationId: OTHER }])("rejects foreign IF data %j", async changes => {
    mocks.schedules.mockResolvedValue([{ ...remote, ...changes }]);
    await expect(run()).rejects.toMatchObject({ code: "invalid_response" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([{ rows: [] }, { rows: [remote, remote] }])("rejects missing or duplicate selected IF schedule %j", async ({ rows }) => {
    mocks.schedules.mockResolvedValue(rows); await expect(run()).rejects.toMatchObject({ code: "conflict" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects another local binding anywhere in the application", async () => {
    mocks.flights.findOne.mockResolvedValue({ id: 55, if_schedule_id: SCHEDULE });
    await expect(run()).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("already owns") }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([{ revision: 5 }, { status: "pending" }, { status: "in_progress" }, { status: "completed" }, { if_schedule_id: OTHER }])("rejects changed or ineligible local flights %j", async changes => {
    Object.assign(flight, changes); await expect(run()).rejects.toMatchObject({ code: "conflict" }); expect(mocks.binding).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects an aircraft occupied by another local flight", async () => {
    mocks.flights.findAll.mockResolvedValue([flight, { ...baseFlight, id: 24, status: "in_progress" }]);
    await expect(run()).rejects.toMatchObject({ code: "conflict" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects an active publishing lease", async () => {
    mocks.outbox.findOne.mockResolvedValue({ state: "processing" }); await expect(run()).rejects.toMatchObject({ code: "conflict" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rechecks actor permissions and all crew awards before adoption", async () => {
    mocks.permission.findAll.mockResolvedValue([]); await expect(run()).rejects.toMatchObject({ code: "forbidden" }); expect(mocks.update).not.toHaveBeenCalled();
    mocks.permission.findAll.mockResolvedValue([{ name: "scheduling" }]); mocks.access.mockResolvedValue(false);
    await expect(run()).rejects.toMatchObject({ code: "crew" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("refuses a changed crew IF identity between preview validation and PUT", async () => {
    let passes = 0; mocks.permission.findAll.mockImplementation(async () => { passes += 1; return [{ name: "scheduling" }]; });
    mocks.pilot.findByPk.mockImplementation(async id => ({ status: 1, ifuserid: id === 12 ? (passes > 1 ? OTHER : CAPTAIN) : CREW }));
    await expect(run()).rejects.toMatchObject({ code: "conflict" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rechecks the shared account after the remote read", async () => {
    mocks.schedules.mockImplementation(async () => { mocks.connection.findByPk.mockResolvedValue({ ...connection, connected_by: 43 }); return [remote]; });
    await expect(run()).rejects.toMatchObject({ code: "connection_changed" }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("validates the combined itinerary rather than duplicating the matched route", async () => {
    mocks.flights.findAll.mockResolvedValue([flight, { ...baseFlight, id: 24, public_id: OTHER, queue_order: 2, departure: "KJFK", arrival: "CYYZ" }]);
    await expect(run()).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("discontinuous") }); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("fails closed while another publisher or editor owns the aircraft lock", async () => {
    mocks.query.mockResolvedValue([{ acquired: 0 }]); await expect(run()).rejects.toMatchObject({ code: "conflict" }); expect(mocks.authorization).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
    expect(lockTransaction.commit).toHaveBeenCalledOnce();
  });
  it("requires authorized durable bindings even when preview OAuth is connected", async () => {
    vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "false"); await expect(run()).rejects.toMatchObject({ code: "disabled" }); expect(mocks.query).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...input(), flightId: 0 }, { ...input(), flightId: 2_147_483_648 }, { ...input(), expectedRevision: 0 },
    { ...input(), expectedRevision: "4" }, { ...input(), scheduleId: "invalid" }, { ...input(), expectedFingerprint: "invalid" }, { ...input(), actorId: 1 }])("rejects invalid input without any side effects %j", async body => {
    await expect(run(body)).rejects.toMatchObject({ code: "validation" }); expect(mocks.authorization).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.query).not.toHaveBeenCalled();
  });
});
