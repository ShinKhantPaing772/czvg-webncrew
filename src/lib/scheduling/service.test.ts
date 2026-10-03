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
  };
});

vi.mock("@/lib/database", () => ({ default: { transaction: mocks.transaction, query: mocks.query } }));
vi.mock("@/lib/models", () => ({ models: { Pilot: mocks.Pilot, Aircraft: mocks.Aircraft, AwardGranted: mocks.AwardGranted } }));
vi.mock("./access", () => ({ canAccessLiveScheduling: mocks.eligible, livePilotAwardId: () => 7 }));
vi.mock("./models", () => ({
  LiveAircraft: mocks.LiveAircraft, LiveFlight: mocks.LiveFlight, LiveFlightMember: mocks.LiveFlightMember,
  LiveScheduleEvent: mocks.LiveScheduleEvent, IfLiveConnection: mocks.IfLiveConnection, IfLiveOutbox: mocks.IfLiveOutbox,
}));

import { changeAircraft, changeFlight, requestFlight, schedulingSnapshot } from "./service";

type Row = Record<string, any>;
type TableName = "Pilot" | "Aircraft" | "AwardGranted" | "LiveAircraft" | "LiveFlight" | "LiveFlightMember" | "LiveScheduleEvent" | "IfLiveConnection" | "IfLiveOutbox";
let rows: Record<TableName, Row[]>;
let eligiblePilots: Set<number>;
const captain = { id: 1, admin: false };
const administrator = { id: 9, admin: true };
const transaction = { LOCK: { UPDATE: "UPDATE" } };
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
    Pilot: [1, 2, 3, 4, 5, 9].map(id => ({ id, status: 1, name: `Pilot ${id}`, callsign: `CZV${id}` })),
    Aircraft: [{ id: 1, name: "A350", status: 1 }], AwardGranted: [1, 2, 3, 4, 5].map(pilotid => ({ pilotid, awardid: 7 })),
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
});
afterEach(() => { vi.unstubAllEnvs(); });

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
    flight({ publishing_state: "published", revision: 2, published_revision: 1 });
    rows.LiveAircraft[0].if_aircraft_id = "persisted-id";
    await expect(changeFlight(captain, { flight_id: 1, action: "start" })).rejects.toMatchObject({ status: 409 });
    rows.LiveFlight[0].published_revision = 2;
    await changeFlight(captain, { flight_id: 1, action: "start" });
    expect(rows.LiveFlight[0].status).toBe("in_progress");
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
