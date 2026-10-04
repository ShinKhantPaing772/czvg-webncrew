import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Op } from "sequelize";

const mocks = vi.hoisted(() => {
  const table = () => ({
    findByPk: vi.fn(), findOne: vi.fn(), findAll: vi.fn(), count: vi.fn(),
    create: vi.fn(), update: vi.fn(), destroy: vi.fn(),
  });
  return {
    transaction: vi.fn(), query: vi.fn(), eligible: vi.fn(),
    Pilot: table(), Aircraft: table(), AwardGranted: table(),
    LiveAircraft: table(), LiveFlight: table(), LiveFlightMember: table(),
    LiveScheduleEvent: table(), IfLiveConnection: table(), IfLiveOutbox: table(),
    ifToken: vi.fn(), ifBinding: vi.fn(), ifSchedules: vi.fn(), ifPosition: vi.fn(), ifAirport: vi.fn(),
  };
});

vi.mock("@/lib/database", () => ({ default: { transaction: mocks.transaction, query: mocks.query } }));
vi.mock("@/lib/models", () => ({ models: { Pilot: mocks.Pilot, Aircraft: mocks.Aircraft, AwardGranted: mocks.AwardGranted } }));
vi.mock("./access", () => ({ canAccessLiveScheduling: mocks.eligible, livePilotAwardId: () => 7 }));
vi.mock("./models", () => ({
  LiveAircraft: mocks.LiveAircraft, LiveFlight: mocks.LiveFlight, LiveFlightMember: mocks.LiveFlightMember,
  LiveScheduleEvent: mocks.LiveScheduleEvent, IfLiveConnection: mocks.IfLiveConnection, IfLiveOutbox: mocks.IfLiveOutbox,
}));
vi.mock("./infinite-flight/connection", () => ({ getIfAuthorizationSnapshot: mocks.ifToken }));
vi.mock("./infinite-flight/binding", () => ({ validateIfAircraftBinding: mocks.ifBinding }));
vi.mock("./infinite-flight/client", () => ({ getIfSchedules: mocks.ifSchedules, getIfPosition: mocks.ifPosition, getIfAirport: mocks.ifAirport }));

import { changeAircraft, changeFlight, requestFlight, schedulingSnapshot, schedulingFailure } from "./service";
import { buildIfPayload } from "./infinite-flight/sync";
import { IfLiveError } from "./infinite-flight/config";

type Row = Record<string, any>;
type TableName = "Pilot" | "Aircraft" | "AwardGranted" | "LiveAircraft" | "LiveFlight" | "LiveFlightMember" | "LiveScheduleEvent" | "IfLiveConnection" | "IfLiveOutbox";
let rows: Record<TableName, Row[]>;
let eligiblePilots: Set<number>;
const captain = { id: 1, admin: false };
const administrator = { id: 9, admin: true };
const transaction = { LOCK: { UPDATE: "UPDATE" } };
const IF_AIRCRAFT = "10000000-0000-0000-0000-000000000001";
const IF_ORGANIZATION = "20000000-0000-0000-0000-000000000002";
const IF_SCHEDULE = "30000000-0000-0000-0000-000000000003";
const ifUser = (id: number) => `50000000-0000-0000-0000-${String(id).padStart(12, "0")}`;
const at = (hour: number) => new Date(`2026-10-02T${String(hour).padStart(2, "0")}:00:00Z`);
const comparable = (value: unknown) => value instanceof Date ? value.getTime() : value;

function matches(row: Row, where: Row = {}): boolean {
  return Reflect.ownKeys(where).every(key => {
    const expected = where[key as keyof typeof where];
    if (key === Op.or) return expected.some((condition: Row) => matches(row, condition));
    if (key === Op.and) return expected.every((condition: Row) => matches(row, condition));
    const actual = row[key as string];
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      return Reflect.ownKeys(expected).every(operator => {
        const value = expected[operator];
        if (operator === Op.in) return value.some((item: unknown) => comparable(item) === comparable(actual));
        if (operator === Op.ne) return comparable(actual) !== comparable(value);
        if (operator === Op.gte) return comparable(actual)! >= comparable(value)!;
        throw new Error(`Unsupported mock operator ${String(operator)}`);
      });
    }
    return comparable(actual) === comparable(expected);
  });
}

function instance(row: Row): Row {
  return {
    ...row,
    async update(values: Row) { Object.assign(row, values); Object.assign(this, values); return this; },
    async save() { Object.assign(row, Object.fromEntries(Object.entries(this).filter(([, value]) => typeof value !== "function"))); return this; },
    toJSON() { return { ...row }; },
  };
}

function installTable(name: TableName) {
  const table = mocks[name];
  const select = (options: Row = {}) => {
    const result = rows[name].filter(row => matches(row, options.where));
    if (options.order) result.sort((a, b) => {
      for (const [field, direction] of options.order) {
        const comparison = comparable(a[field])! < comparable(b[field])! ? -1 : comparable(a[field])! > comparable(b[field])! ? 1 : 0;
        if (comparison) return direction === "DESC" ? -comparison : comparison;
      }
      return 0;
    });
    return result;
  };
  table.findByPk.mockReset().mockImplementation(async (id, options: Row = {}) => {
    const row = rows[name].find(item => item.id === Number(id));
    return row ? options.raw ? { ...row } : instance(row) : null;
  });
  table.findAll.mockReset().mockImplementation(async (options: Row = {}) => select(options).map(row => options.raw ? { ...row } : instance(row)));
  table.findOne.mockReset().mockImplementation(async (options: Row = {}) => {
    const row = select(options)[0];
    return row ? options.raw ? { ...row } : instance(row) : null;
  });
  table.count.mockReset().mockImplementation(async (options: Row = {}) => select(options).length);
  table.create.mockReset().mockImplementation(async (values: Row) => {
    const id = Math.max(0, ...rows[name].map(row => row.id)) + 1;
    const row = { id, ...values };
    if (name === "LiveFlight") Object.assign(row, { revision: 1, publishing_state: "local", published_revision: 0, if_schedule_id: null }, values);
    if (name === "LiveAircraft") Object.assign(row, { active: true, if_aircraft_id: null }, values);
    rows[name].push(row);
    return instance(row);
  });
  table.update.mockReset().mockImplementation(async (values: Row, options: Row = {}) => {
    const selected = select(options); selected.forEach(row => Object.assign(row, values)); return [selected.length];
  });
}

function flight(overrides: Row = {}) {
  const row = {
    id: rows.LiveFlight.length + 1, live_aircraft_id: 1, captain_id: 1,
    departure: "CYYZ", arrival: "KJFK", scheduled_departure: at(10), scheduled_arrival: at(12),
    status: "approved", callsign: null, notes: null, revision: 1, published_revision: 0,
    publishing_state: "local", if_schedule_id: null, updated_at: new Date(), ...overrides,
    public_id: `40000000-0000-0000-0000-${String(rows.LiveFlight.length + 1).padStart(12, "0")}`,
  };
  rows.LiveFlight.push(row); return row;
}
function member(pilotId: number, status = "pending", flightId = 1) {
  const row = { id: rows.LiveFlightMember.length + 1, flight_id: flightId, pilot_id: pilotId, status };
  rows.LiveFlightMember.push(row); return row;
}
function proposal(overrides: Row = {}) {
  return { live_aircraft_id: 1, arrival: "KJFK", scheduled_departure: at(10).toISOString(), scheduled_arrival: at(12).toISOString(), ...overrides };
}

beforeEach(() => {
  eligiblePilots = new Set([1, 2, 3, 4, 5]);
  rows = {
    Pilot: [1, 2, 3, 4, 5, 9].map(id => ({ id, status: 1, name: `Pilot ${id}`, callsign: `CZV${id}`, ifuserid: ifUser(id) })),
    Aircraft: [{ id: 1, name: "A350", status: 1, ifaircraftid: IF_AIRCRAFT, ifliveryid: null }], AwardGranted: [1, 2, 3, 4, 5].map(pilotid => ({ pilotid, awardid: 7 })),
    LiveAircraft: [{ id: 1, aircraft_id: 1, registration: "C-LIVE", current_airport: "CYYZ", active: true, if_aircraft_id: null }],
    LiveFlight: [], LiveFlightMember: [], LiveScheduleEvent: [], IfLiveConnection: [], IfLiveOutbox: [],
  };
  for (const name of Object.keys(rows) as TableName[]) installTable(name);
  mocks.eligible.mockReset().mockImplementation(async id => eligiblePilots.has(id));
  mocks.query.mockReset().mockResolvedValue([{ name: "live_scheduling_mutex" }]);
  mocks.transaction.mockReset().mockImplementation(async (_options, work) => {
    const before = structuredClone(rows);
    try { return await work(transaction); }
    catch (error) { rows = before; throw error; }
  });
  vi.stubEnv("IF_LIVE_AUTO_PUBLISH_ENABLED", "false");
  mocks.ifToken.mockReset().mockResolvedValue({ token: "test-if-access", credential: "test-encrypted", owner: 9, organizationId: IF_ORGANIZATION });
  mocks.ifBinding.mockReset().mockResolvedValue({ id: IF_AIRCRAFT });
  mocks.ifSchedules.mockReset().mockImplementation(async () => rows.LiveFlight.filter(row => row.status === "approved").map(row => {
    const crew = [{ userId: ifUser(row.captain_id), role: 0 as const }, ...rows.LiveFlightMember.filter(member => member.flight_id === row.id && member.status === "approved").map(member => ({ userId: ifUser(member.pilot_id), role: 1 as const }))];
    const payload = buildIfPayload(row as any, crew);
    return { ...payload.schedule, id: row.if_schedule_id ?? IF_SCHEDULE, aircraftId: IF_AIRCRAFT, organizationId: IF_ORGANIZATION, status: 1, crew: payload.crew };
  }));
  mocks.ifPosition.mockReset().mockResolvedValue({ id: IF_AIRCRAFT, state: 1, isOnGround: true, latitude: 43.6777, longitude: -79.6248, updatedAt: new Date().toISOString() });
  mocks.ifAirport.mockReset().mockResolvedValue({ icao: "CYYZ", latitude: 43.6777, longitude: -79.6248 });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("database setup diagnostics", () => {
  it("keeps an IF authorization failure separate from the pilot's site access", () => {
    expect(schedulingFailure(new IfLiveError("Reconnect the organization's IF account", "reauth_required", 401))).toEqual({ status: 503, error: "Reconnect the organization's IF account" });
  });
  it("distinguishes a model column mismatch from an unapplied migration", () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = schedulingFailure({ original: { code: "ER_BAD_FIELD_ERROR", sqlMessage: "Unknown column 'LiveFlight.location_updated_at' in 'field list'", sql: "private query", parameters: ["private value"] } });
    expect(result).toEqual({ status: 503, error: "Live scheduling has a database column mismatch. An administrator needs to check the deployed app and database schema." });
    expect(logger).toHaveBeenCalledWith("[Scheduling] Database schema mismatch", { code: "ER_BAD_FIELD_ERROR", identifier: "LiveFlight.location_updated_at" });
  });

  it("keeps migration instructions for missing tables without logging full driver errors", () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = schedulingFailure({ original: { code: "ER_NO_SUCH_TABLE", sqlMessage: "Table 'crew_center.live_flights' doesn't exist", sql: "private query" } });
    expect(result.status).toBe(503);
    expect(result.error).toContain("Apply migrations/20261002_live_scheduling.sql first.");
    expect(logger).toHaveBeenCalledWith("[Scheduling] Database schema mismatch", { code: "ER_NO_SUCH_TABLE", identifier: "crew_center.live_flights" });
  });
});

describe("flight proposals", () => {
  it("accepts an optional callsign and fallback origin without prematurely moving the aircraft", async () => {
    rows.LiveAircraft[0].current_airport = null;
    await requestFlight(captain, proposal({ departure: " cyyz " }));
    expect(rows.LiveFlight[0]).toMatchObject({ departure: "CYYZ", callsign: null, status: "pending" });
    expect(rows.LiveAircraft[0].current_airport).toBeNull();
    await changeFlight(administrator, { flight_id: 1, action: "approve" });
    expect(rows.LiveAircraft[0].current_airport).toBe("CYYZ");
  });

  it("derives origin from approved preceding legs and excludes pending proposals", async () => {
    flight({ departure: "CYYZ", arrival: "KBOS", scheduled_departure: at(7), scheduled_arrival: at(9) });
    flight({ status: "pending", departure: "KBOS", arrival: "EGLL", scheduled_departure: at(8), scheduled_arrival: at(9) });
    await requestFlight(captain, proposal({ arrival: "CYUL", departure: "WRNG" }));
    expect(rows.LiveFlight[2].departure).toBe("KBOS");
  });

  it("allows competing pending requests without reserving aircraft or crew", async () => {
    await requestFlight(captain, proposal());
    await requestFlight({ id: 2, admin: false }, proposal({ arrival: "KBOS" }));
    expect(rows.LiveFlight.map(row => row.status)).toEqual(["pending", "pending"]);
    expect(rows.LiveAircraft[0].current_airport).toBe("CYYZ");
    expect(rows.IfLiveOutbox).toHaveLength(0);
    await expect(requestFlight(captain, proposal())).rejects.toMatchObject({ status: 409 });
  });

  it("rolls back an approval whose aircraft window conflicts", async () => {
    flight({ scheduled_departure: at(9), scheduled_arrival: at(12) });
    flight({ captain_id: 2, status: "pending", departure: "KJFK", arrival: "KBOS", scheduled_departure: at(11), scheduled_arrival: at(13) });
    await expect(changeFlight(administrator, { flight_id: 2, action: "approve" })).rejects.toMatchObject({ status: 409 });
    expect(rows.LiveFlight[1]).toMatchObject({ status: "pending", revision: 1 });
    expect(rows.LiveScheduleEvent).toHaveLength(0);
  });

  it("rolls back a proposal when writing its audit event fails", async () => {
    mocks.LiveScheduleEvent.create.mockRejectedValueOnce(new Error("Audit write failed"));
    await expect(requestFlight(captain, proposal())).rejects.toThrow("Audit write failed");
    expect(rows.LiveFlight).toHaveLength(0);
  });

  it("reports a missing migration before making any scheduling changes", async () => {
    mocks.query.mockResolvedValue([]);
    await expect(requestFlight(captain, proposal())).rejects.toMatchObject({ status: 503 });
    expect(rows.LiveFlight).toHaveLength(0);
  });
});

describe("captain and administrator authority", () => {
  it.each(["approve", "amend", "reassign", "reject"])("requires an administrator for %s", async action => {
    flight({ status: "pending" });
    await expect(changeFlight(captain, { flight_id: 1, action, reason: "Requested change" })).rejects.toMatchObject({ status: 403 });
    expect(rows.LiveFlight[0].status).toBe("pending");
  });

  it.each(["edit", "cancel", "start", "complete"])("denies another pilot's %s action", async action => {
    flight({ status: action === "edit" ? "pending" : action === "complete" ? "in_progress" : "approved" });
    await expect(changeFlight({ id: 4, admin: false }, { flight_id: 1, action, actual_arrival: "KJFK" })).rejects.toMatchObject({ status: 403 });
  });

  it("lets the assigned captain approve a crew request but denies unrelated pilots", async () => {
    flight(); member(2);
    await expect(changeFlight({ id: 4, admin: false }, { flight_id: 1, action: "approve_join", member_id: 1 })).rejects.toMatchObject({ status: 403 });
    await changeFlight(captain, { flight_id: 1, action: "approve_join", member_id: 1 });
    expect(rows.LiveFlightMember[0].status).toBe("approved");
  });

  it("requires a reason when rejecting a crew request", async () => {
    flight(); member(2);
    await expect(changeFlight(captain, { flight_id: 1, action: "reject_join", member_id: 1 })).rejects.toMatchObject({ status: 400 });
    expect(rows.LiveFlightMember[0].status).toBe("pending");
    await changeFlight(captain, { flight_id: 1, action: "reject_join", member_id: 1, reason: "Training incomplete" });
    expect(rows.LiveFlightMember[0].status).toBe("rejected");
  });
});

describe("crew eligibility and capacity", () => {
  it("admits at most two additional approved crew while pending requests consume no seats", async () => {
    flight(); member(2, "approved"); member(3); member(4);
    await changeFlight(captain, { flight_id: 1, action: "approve_join", member_id: 2 });
    await expect(changeFlight(captain, { flight_id: 1, action: "approve_join", member_id: 3 })).rejects.toMatchObject({ status: 409 });
    expect(rows.LiveFlightMember.map(row => row.status)).toEqual(["approved", "approved", "pending"]);
    expect(rows.LiveFlight[0].revision).toBe(2);
  });

  it("rechecks a joining pilot's eligibility at approval", async () => {
    flight(); member(2); eligiblePilots.delete(2);
    await expect(changeFlight(captain, { flight_id: 1, action: "approve_join", member_id: 1 })).rejects.toMatchObject({ status: 403 });
    expect(rows.LiveFlightMember[0].status).toBe("pending");
  });

  it("does not reserve a pilot through a pending join request", async () => {
    flight();
    flight({ live_aircraft_id: 2, captain_id: 2 });
    await changeFlight({ id: 2, admin: false }, { flight_id: 1, action: "join" });
    expect(rows.LiveFlightMember[0].status).toBe("pending");
    await expect(changeFlight(captain, { flight_id: 1, action: "approve_join", member_id: 1 })).rejects.toMatchObject({ status: 409 });
  });

  it("rejects a crew approval that overlaps another tail's flight", async () => {
    flight(); member(2);
    flight({ live_aircraft_id: 2, captain_id: 2 });
    await expect(changeFlight(captain, { flight_id: 1, action: "approve_join", member_id: 1 })).rejects.toMatchObject({ status: 409 });
    expect(rows.LiveFlightMember[0].status).toBe("pending");
  });

  it("promotes a crew member to captain without consuming an additional seat", async () => {
    flight(); member(2, "approved"); member(3, "approved");
    await changeFlight(administrator, { flight_id: 1, action: "reassign", captain_id: 2 });
    expect(rows.LiveFlight[0].captain_id).toBe(2);
    expect(rows.LiveFlightMember[0].status).toBe("withdrawn");
    expect(rows.LiveFlightMember[1].status).toBe("approved");
  });
});

describe("persistent aircraft chain repair", () => {
  function configuredIfPublishing() {
    for (const name of ["IF_LIVE_PREVIEW_ENABLED", "IF_LIVE_AUTO_PUBLISH_ENABLED", "IF_LIVE_DURABLE_BINDINGS_ALLOWED"]) vi.stubEnv(name, " TRUE ");
    vi.stubEnv("IF_LIVE_CLIENT_ID", "test-client"); vi.stubEnv("IF_LIVE_CLIENT_SECRET", "test-secret");
    vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://ifczvg.com/oauth/callback");
    vi.stubEnv("IF_LIVE_REVOCATION_URL", "https://api.infiniteflight.com/supported-test-revoke");
    vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    rows.IfLiveConnection.push({ id: 1, organization_id: IF_ORGANIZATION, state: "connected", access_token_encrypted: "test-encrypted", connected_by: 9 });
  }

  it("uses the same normalized publishing flags as OAuth when binding aircraft", async () => {
    configuredIfPublishing();
    await changeAircraft(administrator, { action: "edit_aircraft", live_aircraft_id: 1, if_aircraft_id: "12345678-1234-1234-1234-123456789abc" });
    expect(rows.LiveAircraft[0].if_aircraft_id).toBe("12345678-1234-1234-1234-123456789abc");
    expect(mocks.ifBinding).toHaveBeenCalledWith(expect.objectContaining({ token: "test-if-access", organizationId: IF_ORGANIZATION, ifAircraftId: "12345678-1234-1234-1234-123456789abc", catalog: expect.objectContaining({ id: 1 }) }));
  });

  it("does not save a mismatched IF aircraft binding", async () => {
    configuredIfPublishing(); mocks.ifBinding.mockRejectedValue(new IfLiveError("The IF aircraft type does not match", "binding", 409));
    await expect(changeAircraft(administrator, { action: "edit_aircraft", live_aircraft_id: 1, if_aircraft_id: IF_AIRCRAFT })).rejects.toMatchObject({ code: "binding", status: 409 });
    expect(rows.LiveAircraft[0].if_aircraft_id).toBeNull(); expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("validates a new catalog type against an existing IF binding", async () => {
    configuredIfPublishing(); rows.LiveAircraft[0].if_aircraft_id = IF_AIRCRAFT;
    rows.Aircraft.push({ id: 2, name: "B737", status: 1, ifaircraftid: IF_ORGANIZATION, ifliveryid: null });
    mocks.ifBinding.mockRejectedValue(new IfLiveError("The IF aircraft type does not match", "binding", 409));
    await expect(changeAircraft(administrator, { action: "edit_aircraft", live_aircraft_id: 1, aircraft_id: 2 })).rejects.toMatchObject({ status: 409 });
    expect(rows.LiveAircraft[0].aircraft_id).toBe(1);
    expect(mocks.ifBinding).toHaveBeenCalledWith(expect.objectContaining({ catalog: expect.objectContaining({ id: 2 }) }));
  });

  it("rechecks the catalog after upstream binding validation", async () => {
    configuredIfPublishing(); mocks.ifBinding.mockImplementation(async () => { rows.Aircraft[0].ifaircraftid = IF_ORGANIZATION; });
    await expect(changeAircraft(administrator, { action: "edit_aircraft", live_aircraft_id: 1, if_aircraft_id: IF_AIRCRAFT })).rejects.toThrow("changed during validation");
    expect(rows.LiveAircraft[0].if_aircraft_id).toBeNull();
  });

  it("rejects binding when OAuth lacks a supported revocation configuration", async () => {
    configuredIfPublishing(); vi.stubEnv("IF_LIVE_REVOCATION_URL", "");
    await expect(changeAircraft(administrator, { action: "edit_aircraft", live_aircraft_id: 1, if_aircraft_id: "12345678-1234-1234-1234-123456789abc" })).rejects.toMatchObject({ status: 409 });
    expect(rows.LiveAircraft[0].if_aircraft_id).toBeNull();
  });

  it("keeps aircraft on local scheduling during OAuth testing without automatic publishing", async () => {
    configuredIfPublishing(); vi.stubEnv("IF_LIVE_AUTO_PUBLISH_ENABLED", "false");
    await expect(changeAircraft(administrator, { action: "edit_aircraft", live_aircraft_id: 1, if_aircraft_id: "12345678-1234-1234-1234-123456789abc" })).rejects.toMatchObject({ status: 409 });
    expect(rows.LiveAircraft[0].if_aircraft_id).toBeNull();
  });

  it("allows unbinding completed IF history while preserving its identifiers", async () => {
    rows.LiveAircraft[0].if_aircraft_id = "persisted-aircraft";
    flight({ status: "completed", if_schedule_id: "historical-schedule", publishing_state: "published" });
    await changeAircraft(administrator, { action: "edit_aircraft", live_aircraft_id: 1, if_aircraft_id: null });
    expect(rows.LiveAircraft[0].if_aircraft_id).toBeNull();
    expect(rows.LiveFlight[0].if_schedule_id).toBe("historical-schedule");
  });

  it("blocks unbinding until an uncertain completed-flight job is resolved", async () => {
    rows.LiveAircraft[0].if_aircraft_id = "persisted-aircraft";
    flight({ status: "completed", if_schedule_id: "historical-schedule", publishing_state: "published" });
    rows.IfLiveOutbox.push({ id: 1, flight_id: 1, revision: 1, state: "reconciliation" });
    await expect(changeAircraft(administrator, { action: "edit_aircraft", live_aircraft_id: 1, if_aircraft_id: null })).rejects.toMatchObject({ status: 409 });
  });

  it("blocks unbinding cancelled reservations until IF deletion is confirmed", async () => {
    rows.LiveAircraft[0].if_aircraft_id = "persisted-aircraft";
    flight({ status: "cancelled", if_schedule_id: "remote-schedule", publishing_state: "failed" });
    await expect(changeAircraft(administrator, { action: "edit_aircraft", live_aircraft_id: 1, if_aircraft_id: null })).rejects.toMatchObject({ status: 409 });
  });

  it("marks dependent successors for review after cancellation", async () => {
    flight(); flight({ departure: "KJFK", arrival: "EGLL", scheduled_departure: at(13), scheduled_arrival: at(18) });
    await expect(changeFlight(captain, { flight_id: 1, action: "cancel" })).rejects.toMatchObject({ status: 403 });
    await changeFlight(administrator, { flight_id: 1, action: "cancel" });
    expect(rows.LiveFlight.map(row => row.status)).toEqual(["cancelled", "needs_review"]);
    expect(rows.LiveAircraft[0].current_airport).toBe("CYYZ");
    expect(rows.LiveScheduleEvent.some(row => row.action === "chain_invalidated")).toBe(true);
  });

  it("amends an approved destination and invalidates downstream origins", async () => {
    flight(); flight({ departure: "KJFK", arrival: "EGLL", scheduled_departure: at(13), scheduled_arrival: at(18) });
    await changeFlight(administrator, { flight_id: 1, action: "amend", arrival: "KBOS" });
    expect(rows.LiveFlight[0]).toMatchObject({ status: "approved", arrival: "KBOS" });
    expect(rows.LiveFlight[1].status).toBe("needs_review");
  });

  it("uses a diversion's actual arrival and preserves later legs that still connect", async () => {
    flight({ status: "in_progress" });
    flight({ departure: "KJFK", arrival: "EGLL", scheduled_departure: at(13), scheduled_arrival: at(16) });
    flight({ departure: "KBOS", arrival: "CYUL", scheduled_departure: at(17), scheduled_arrival: at(19) });
    await changeFlight(captain, { flight_id: 1, action: "complete", actual_arrival: "kbos" });
    expect(rows.LiveAircraft[0].current_airport).toBe("KBOS");
    expect(rows.LiveFlight.map(row => row.status)).toEqual(["completed", "needs_review", "approved"]);
  });

  it("flags affected flights after an administrator corrects the current location", async () => {
    flight();
    await changeAircraft(administrator, { action: "edit_aircraft", live_aircraft_id: 1, current_airport: "KBOS" });
    expect(rows.LiveFlight[0].status).toBe("needs_review");
    expect(rows.LiveAircraft[0].current_airport).toBe("KBOS");
  });
});

describe("start and completion policies", () => {
  it("starts only the aircraft's first approved leg", async () => {
    flight(); flight({ departure: "KJFK", arrival: "KBOS", scheduled_departure: at(13), scheduled_arrival: at(15) });
    await expect(changeFlight(captain, { flight_id: 2, action: "start" })).rejects.toMatchObject({ status: 409 });
    await changeFlight(captain, { flight_id: 1, action: "start" });
    expect(rows.LiveFlight[0].status).toBe("in_progress");
  });

  it("requires the actual aircraft origin to match before starting", async () => {
    flight(); rows.LiveAircraft[0].current_airport = "KBOS";
    await expect(changeFlight(captain, { flight_id: 1, action: "start" })).rejects.toMatchObject({ status: 409 });
    expect(rows.LiveFlight[0].status).toBe("approved");
  });

  it("rechecks every approved crew member before start", async () => {
    flight(); member(2, "approved"); eligiblePilots.delete(2);
    await expect(changeFlight(captain, { flight_id: 1, action: "start" })).rejects.toMatchObject({ status: 403 });
  });

  it("prevents starting while a crew member is in another flight even when scheduled intervals differ", async () => {
    flight(); member(2, "approved");
    flight({ live_aircraft_id: 2, captain_id: 2, status: "in_progress", scheduled_departure: at(6), scheduled_arrival: at(8) });
    await expect(changeFlight(captain, { flight_id: 1, action: "start" })).rejects.toMatchObject({ status: 409 });
  });

  it("requires the latest external schedule revision before starting a bound aircraft", async () => {
    flight({ publishing_state: "published", revision: 2, published_revision: 1, if_schedule_id: IF_SCHEDULE });
    rows.LiveAircraft[0].if_aircraft_id = IF_AIRCRAFT;
    rows.IfLiveConnection.push({ id: 1, organization_id: IF_ORGANIZATION, state: "connected", access_token_encrypted: "test-encrypted", connected_by: 9 });
    await expect(changeFlight(captain, { flight_id: 1, action: "start" })).rejects.toMatchObject({ status: 409 });
    expect(mocks.ifSchedules).not.toHaveBeenCalled();
    rows.LiveFlight[0].published_revision = 2;
    await changeFlight(captain, { flight_id: 1, action: "start" });
    expect(rows.LiveFlight[0].status).toBe("in_progress");
    expect(mocks.ifSchedules).toHaveBeenCalledWith("test-if-access", IF_AIRCRAFT, { fresh: true });
    expect(mocks.ifPosition).toHaveBeenCalledWith("test-if-access", IF_AIRCRAFT, { fresh: true });
    expect(mocks.ifAirport).toHaveBeenCalledWith("CYYZ", { fresh: true });
  });

  function linkedFlight() {
    const row = flight({ publishing_state: "published", published_revision: 1, if_schedule_id: IF_SCHEDULE });
    rows.LiveAircraft[0].if_aircraft_id = IF_AIRCRAFT;
    rows.IfLiveConnection.push({ id: 1, organization_id: IF_ORGANIZATION, state: "connected", access_token_encrypted: "test-encrypted", connected_by: 9 });
    return row;
  }

  it("blocks a locally published flight whose IF reservation was deleted", async () => {
    linkedFlight(); mocks.ifSchedules.mockResolvedValue([]);
    await expect(changeFlight(captain, { flight_id: 1, action: "start" })).rejects.toMatchObject({ status: 409 });
    expect(rows.LiveFlight[0].status).toBe("approved"); expect(rows.LiveScheduleEvent).toHaveLength(0);
  });

  it("blocks a flight after its IF aircraft moved to another airport", async () => {
    linkedFlight(); mocks.ifPosition.mockResolvedValue({ id: IF_AIRCRAFT, state: 1, isOnGround: true, latitude: 40.6413, longitude: -73.7781 });
    await expect(changeFlight(captain, { flight_id: 1, action: "start" })).rejects.toThrow("outside the 5 nautical mile vicinity");
    expect(rows.LiveFlight[0].status).toBe("approved");
  });

  it("fails closed when fresh IF reads are unavailable", async () => {
    linkedFlight(); mocks.ifPosition.mockRejectedValue(new IfLiveError("IF position is unavailable", "unavailable", 503));
    await expect(changeFlight(captain, { flight_id: 1, action: "start" })).rejects.toMatchObject({ status: 503 });
    expect(rows.LiveFlight[0].status).toBe("approved"); expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a flight amended while IF departure checks are running", async () => {
    linkedFlight(); mocks.ifPosition.mockImplementation(async () => {
      rows.LiveFlight[0].revision = 2;
      return { id: IF_AIRCRAFT, state: 1, isOnGround: true, latitude: 43.6777, longitude: -79.6248 };
    });
    await expect(changeFlight(captain, { flight_id: 1, action: "start" })).rejects.toMatchObject({ status: 409 });
    expect(rows.LiveFlight[0].status).toBe("approved");
  });

  it("rejects an IF user ID changed without a flight revision during departure checks", async () => {
    linkedFlight(); mocks.ifPosition.mockImplementation(async () => {
      rows.Pilot[0].ifuserid = ifUser(5);
      return { id: IF_AIRCRAFT, state: 1, isOnGround: true, latitude: 43.6777, longitude: -79.6248 };
    });
    await expect(changeFlight(captain, { flight_id: 1, action: "start" })).rejects.toThrow("changed during the departure check");
    expect(rows.LiveFlight[0].status).toBe("approved");
  });

  it("rejects a different local leg cancelled while IF departure checks run", async () => {
    linkedFlight();
    flight({ id: 2, departure: "KJFK", arrival: "KBOS", scheduled_departure: at(13), scheduled_arrival: at(15), if_schedule_id: "60000000-0000-0000-0000-000000000006" });
    mocks.ifPosition.mockImplementation(async () => {
      rows.LiveFlight[1].status = "cancelled";
      return { id: IF_AIRCRAFT, state: 1, isOnGround: true, latitude: 43.6777, longitude: -79.6248 };
    });
    await expect(changeFlight(captain, { flight_id: 1, action: "start" })).rejects.toThrow("changed during the departure check");
    expect(rows.LiveFlight[0].status).toBe("approved");
  });

  it("rejects IF connection rotation during the departure check", async () => {
    linkedFlight(); mocks.ifPosition.mockImplementation(async () => {
      rows.IfLiveConnection[0].access_token_encrypted = "new-encrypted-credential";
      return { id: IF_AIRCRAFT, state: 1, isOnGround: true, latitude: 43.6777, longitude: -79.6248 };
    });
    await expect(changeFlight(captain, { flight_id: 1, action: "start" })).rejects.toThrow("changed during the departure check");
    expect(rows.LiveFlight[0].status).toBe("approved");
  });

  it("rejects an authorization token from a previous connection before IF reads", async () => {
    linkedFlight();
    mocks.ifToken.mockImplementation(async () => {
      rows.IfLiveConnection[0].access_token_encrypted = "replacement-connection";
      return { token: "previous-access", credential: "test-encrypted", owner: 9, organizationId: IF_ORGANIZATION };
    });
    await expect(changeFlight(captain, { flight_id: 1, action: "start" })).rejects.toThrow("changed while checking access");
    expect(mocks.ifSchedules).not.toHaveBeenCalled(); expect(rows.LiveFlight[0].status).toBe("approved");
  });

  it("expires a departure check that waited too long for local locks", async () => {
    vi.useFakeTimers(); linkedFlight();
    mocks.query.mockImplementation(async () => { vi.setSystemTime(Date.now() + 31_000); return [{ name: "live_scheduling_mutex" }]; });
    await expect(changeFlight(captain, { flight_id: 1, action: "start" })).rejects.toThrow("changed during the departure check");
    expect(rows.LiveFlight[0].status).toBe("approved");
  });

  it("denies another pilot before fetching any IF scheduling data", async () => {
    linkedFlight();
    await expect(changeFlight({ id: 4, admin: false }, { flight_id: 1, action: "start" })).rejects.toMatchObject({ status: 403 });
    expect(mocks.ifToken).not.toHaveBeenCalled();
  });

  it("performs no IF reads for manually scheduled departures", async () => {
    flight(); await changeFlight(captain, { flight_id: 1, action: "start" });
    expect(mocks.ifToken).not.toHaveBeenCalled(); expect(rows.LiveFlight[0].status).toBe("in_progress");
  });

  it("does not complete an unstarted flight or without an actual arrival", async () => {
    flight();
    await expect(changeFlight(captain, { flight_id: 1, action: "complete", actual_arrival: "KJFK" })).rejects.toMatchObject({ status: 409 });
    rows.LiveFlight[0].status = "in_progress";
    await expect(changeFlight(captain, { flight_id: 1, action: "complete" })).rejects.toMatchObject({ status: 400 });
    expect(rows.LiveAircraft[0].current_airport).toBe("CYYZ");
  });
});

it("keeps pending schedules private and exposes revoked-eligibility flags to the admin", async () => {
  flight({ status: "pending", captain_id: 2 });
  flight({ captain_id: 3, departure: "CYYZ", arrival: "KBOS" });
  rows.AwardGranted = rows.AwardGranted.filter(grant => grant.pilotid !== 3);
  const pilotView = await schedulingSnapshot(captain);
  expect(pilotView.flights.map(row => row.id)).toEqual([2]);
  expect(pilotView.flights[0].eligibility_issues).toHaveLength(1);
  const adminView = await schedulingSnapshot(administrator);
  expect(adminView.flights).toHaveLength(2);
});
