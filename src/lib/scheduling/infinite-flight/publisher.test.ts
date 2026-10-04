import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Op, QueryTypes, Sequelize, type Transaction } from "sequelize";
const mocks = vi.hoisted(() => {
  const model = () => ({ findByPk: vi.fn(), findAll: vi.fn(), findOne: vi.fn(), update: vi.fn(), count: vi.fn(), create: vi.fn() });
  return { transaction: vi.fn(), query: vi.fn(), liveFlight: model(), aircraft: model(), outbox: model(), connection: model(), member: model(), event: model(), pilot: model(), catalog: model(), binding: vi.fn(), access: vi.fn(), token: vi.fn(), fleet: vi.fn(), schedules: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), putCrew: vi.fn(), removeCrew: vi.fn(), reorder: vi.fn() };
});
vi.mock("@/lib/database", () => ({ default: { transaction: mocks.transaction, query: mocks.query } }));
vi.mock("@/lib/models", () => ({ models: { Pilot: mocks.pilot, Aircraft: mocks.catalog } }));
vi.mock("@/lib/scheduling/models", () => ({ LiveFlight: mocks.liveFlight, LiveAircraft: mocks.aircraft, IfLiveOutbox: mocks.outbox, IfLiveConnection: mocks.connection, LiveFlightMember: mocks.member, LiveScheduleEvent: mocks.event }));
vi.mock("@/lib/scheduling/access", () => ({ canAccessLiveScheduling: mocks.access }));
vi.mock("./connection", () => ({ getIfAuthorizationSnapshot: mocks.token }));
vi.mock("./binding", () => ({ validateIfAircraftBinding: mocks.binding }));
vi.mock("./client", () => ({ getIfFleet: mocks.fleet, getIfSchedules: mocks.schedules, createIfSchedule: mocks.create, updateIfSchedule: mocks.update, deleteIfSchedule: mocks.remove, putIfCrew: mocks.putCrew, removeIfCrew: mocks.removeCrew, reorderIfSchedule: mocks.reorder }));
import { runIfLivePublisher } from "./publisher";
import { IfLiveError } from "./config";
import { buildIfPayload } from "./sync";

const UUID = "10000000-0000-0000-0000-000000000001";
const REMOTE_ID = "20000000-0000-0000-0000-000000000002";
const selectionQueries = () => mocks.query.mock.calls.filter(([sql]) => String(sql).includes("FROM if_live_outbox AS pending"));
let job: any; let flight: any; let lockTransaction: any;
beforeEach(() => {
  vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "true"); vi.stubEnv("IF_LIVE_AUTO_PUBLISH_ENABLED", "true"); vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "true");
  vi.stubEnv("IF_LIVE_CLIENT_ID", "ifc_test"); vi.stubEnv("IF_LIVE_CLIENT_SECRET", "client-secret"); vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://example.com/api/admin/scheduling/if/callback"); vi.stubEnv("IF_LIVE_REVOCATION_URL", "https://api.infiniteflight.com/supported-test-revoke");
  job = { id: 1, flight_id: 1, revision: 1, state: "queued", attempts: 0, next_attempt_at: new Date(0), get: vi.fn(() => "sync"), update: vi.fn(async function(this: any, values: any) { Object.assign(this, values); return this; }) };
  flight = { id: 1, public_id: UUID, live_aircraft_id: 7, captain_id: 42, callsign: null, departure: "CYYZ", arrival: "CYVR", scheduled_departure: new Date("2026-10-04T10:00:00Z"), scheduled_arrival: new Date("2026-10-04T15:00:00Z"), status: "approved", notes: null, revision: 1, published_revision: 0, publishing_state: "queued", if_schedule_id: null, last_published_payload: null, update: vi.fn(async function(this: any, values: any) { Object.assign(this, values); return this; }) };
  lockTransaction = { LOCK: { UPDATE: "UPDATE" }, commit: vi.fn(async () => undefined) };
  mocks.transaction.mockImplementation(async (callback: any) => callback ? callback(lockTransaction) : lockTransaction);
  mocks.query.mockImplementation(async (query: string, options: any) => query.includes("FROM if_live_outbox AS pending")
    ? options.replacements.attemptedIds.includes(job.id) ? [] : [job]
    : query.includes("GET_LOCK") ? [{ acquired: 1 }] : query.includes("RELEASE_LOCK") ? [] : [{ name: "live_scheduling_mutex" }]);
  mocks.outbox.findAll.mockImplementation(async (options: any) => options.where.state === "processing" ? [] : [job]); mocks.outbox.findByPk.mockResolvedValue(job); mocks.outbox.count.mockResolvedValue(0); mocks.outbox.update.mockResolvedValue([1]);
  mocks.liveFlight.findByPk.mockImplementation(async () => flight); mocks.liveFlight.findAll.mockImplementation(async (options: any) => options.attributes?.[0] === "id" ? [] : typeof options.where.status === "object" ? [flight] : []); mocks.liveFlight.update.mockResolvedValue([1]); mocks.member.findAll.mockResolvedValue([]);
  mocks.aircraft.findByPk.mockResolvedValue({ id: 7, aircraft_id: 1, if_aircraft_id: UUID, active: true }); mocks.connection.findByPk.mockResolvedValue({ organization_id: UUID, state: "connected", connected_by: 9, access_token_encrypted: "test-encrypted" }); mocks.token.mockResolvedValue({ token: "if-access-token", credential: "test-encrypted", owner: 9, organizationId: UUID });
  mocks.catalog.findByPk.mockResolvedValue({ id: 1, status: 1, ifaircraftid: UUID, ifliveryid: null }); mocks.binding.mockResolvedValue({ id: UUID });
  mocks.pilot.findAll.mockResolvedValue([{ id: 42, ifuserid: UUID }]); mocks.access.mockResolvedValue(true);
  mocks.fleet.mockResolvedValue([{ id: UUID, organizationId: UUID, isFleetActiveSlot: true }]);
  const payload = buildIfPayload(flight, [{ userId: UUID, role: 0 }]); const remote = { ...payload.schedule, id: REMOTE_ID, aircraftId: UUID, organizationId: UUID, status: 1, crew: [] };
  mocks.schedules.mockResolvedValueOnce([]).mockResolvedValue([remote]);
  mocks.create.mockResolvedValue(remote); mocks.putCrew.mockResolvedValue({ ...remote, crew: payload.crew }); mocks.event.create.mockResolvedValue({});
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

describe("IF durable publishing worker", () => {
  it("does no queue or IF work until all integration gates are enabled", async () => {
    vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "false");
    expect(await runIfLivePublisher()).toMatchObject({ disabled: true, processed: 0 }); expect(mocks.outbox.findAll).not.toHaveBeenCalled(); expect(mocks.token).not.toHaveBeenCalled();
  });
  it.each([
    { label: "unset", value: undefined },
    { label: "empty", value: "" },
    { label: "whitespace", value: "  \t " },
  ])("does no database or IF work with a $label revocation URL despite working OAuth configuration", async ({ value }) => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", value);
    const result = await runIfLivePublisher();
    expect(result).toMatchObject({ disabled: true, processed: 0, published: 0 });
    expect(result).toHaveProperty("reasons", ["Automatic IF publishing requires a supported OAuth revocation URL"]);
    expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.outbox.findAll).not.toHaveBeenCalled(); expect(mocks.outbox.update).not.toHaveBeenCalled();
    expect(mocks.token).not.toHaveBeenCalled(); expect(mocks.fleet).not.toHaveBeenCalled(); expect(mocks.schedules).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
    expect(job).toMatchObject({ state: "queued", attempts: 0 });
  });
  it("checks award eligibility again before publishing approved crew", async () => {
    mocks.access.mockResolvedValue(false);
    const result = await runIfLivePublisher(); expect(result.states).toEqual({ failed: 1 }); expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.outbox.update).toHaveBeenCalledWith(expect.objectContaining({ state: "failed" }), expect.anything());
    expect(mocks.query.mock.calls.some(([query]) => String(query).includes("RELEASE_LOCK"))).toBe(true);
  });
  it("stops crew assignment when the award is revoked after schedule creation", async () => {
    mocks.create.mockImplementation(async () => {
      mocks.access.mockResolvedValue(false);
      const payload = buildIfPayload(flight, [{ userId: UUID, role: 0 }]);
      return { ...payload.schedule, id: REMOTE_ID, aircraftId: UUID, organizationId: UUID, status: 1, crew: [] };
    });
    const result = await runIfLivePublisher(); expect(result.states).toEqual({ failed: 1 }); expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.putCrew).not.toHaveBeenCalled(); expect(mocks.liveFlight.update).toHaveBeenCalledWith(expect.objectContaining({ if_schedule_id: REMOTE_ID }), expect.anything());
  });
  it("records an uncertain create in reconciliation and isolates stale failures", async () => {
    mocks.create.mockImplementation(async () => { flight = { ...flight, revision: 2 }; throw new IfLiveError("unknown outcome", "unavailable", 502, 60, true); });
    const result = await runIfLivePublisher(); expect(result.states).toEqual({ reconciliation: 1 });
    const failure = mocks.liveFlight.update.mock.calls.find(([values]) => values.publishing_state === "reconciliation");
    expect(failure?.[1].where).toEqual({ id: 1, revision: 1 }); expect(mocks.create).toHaveBeenCalledOnce();
  });
  it("preserves a completed older publish's binding while leaving a newer local revision queued", async () => {
    mocks.putCrew.mockImplementation(async () => {
      flight = { ...flight, revision: 2, published_revision: 5 };
      const payload = buildIfPayload(flight, [{ userId: UUID, role: 0 }]); return { ...payload.schedule, id: REMOTE_ID, status: 1, crew: payload.crew };
    });
    const result = await runIfLivePublisher(); expect(result.published).toBe(1);
    expect(flight.update).toHaveBeenCalledWith(expect.objectContaining({ published_revision: 5, if_schedule_id: REMOTE_ID, publishing_state: "queued" }), expect.anything());
  });
  it("rechecks the latest local revision immediately before a network mutation", async () => {
    mocks.schedules.mockReset();
    mocks.schedules.mockImplementation(async () => { flight = { ...flight, revision: 2 }; return []; });
    const result = await runIfLivePublisher(); expect(result.states).toEqual({ done: 1 }); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("moves a newly appended managed leg into the latest local queue order using fresh snapshots", async () => {
    const nextPublicId = "40000000-0000-0000-0000-000000000004";
    const nextRemoteId = "50000000-0000-0000-0000-000000000005";
    const payload = buildIfPayload(flight, [{ userId: UUID, role: 0 }]);
    const current = { ...payload.schedule, id: REMOTE_ID, aircraftId: UUID, organizationId: UUID, status: 1, crew: payload.crew };
    const nextPayload = buildIfPayload({ ...flight, id: 2, public_id: nextPublicId, departure: "CYVR", arrival: "CYYZ", scheduled_departure: new Date("2026-10-04T16:00:00Z"), scheduled_arrival: new Date("2026-10-04T21:00:00Z") }, payload.crew);
    const next = { ...current, ...nextPayload.schedule, id: nextRemoteId };
    mocks.schedules.mockReset().mockResolvedValueOnce([next]).mockResolvedValue([next, current]);
    mocks.liveFlight.findAll.mockImplementation(async (options: any) => options.attributes?.[0] === "id" ? [] : typeof options.where.status === "object" ? [flight, { ...flight, id: 2, public_id: nextPublicId, departure: "CYVR", arrival: "CYYZ", scheduled_departure: new Date(nextPayload.schedule.scheduledDepartureUtc), scheduled_arrival: new Date(nextPayload.schedule.scheduledArrivalUtc), if_schedule_id: nextRemoteId, last_published_payload: nextPayload, published_revision: 1 }] : []);
    const result = await runIfLivePublisher(); expect(result.published).toBe(1);
    expect(mocks.reorder).toHaveBeenCalledWith("if-access-token", UUID, REMOTE_ID, null);
    expect(mocks.schedules).toHaveBeenNthCalledWith(1, "if-access-token", UUID, { fresh: true });
    expect(mocks.schedules).toHaveBeenNthCalledWith(2, "if-access-token", UUID, { fresh: true });
  });

  it("rejects aircraft content drift before writing a schedule", async () => {
    mocks.binding.mockRejectedValue(new IfLiveError("The IF aircraft type does not match", "binding", 409));
    expect(await runIfLivePublisher()).toMatchObject({ published: 0, states: { failed: 1 } });
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.putCrew).not.toHaveBeenCalled();
  });

  it("rechecks the validated catalog before the first IF write", async () => {
    mocks.binding.mockImplementation(async () => { mocks.catalog.findByPk.mockResolvedValue({ id: 1, status: 1, ifaircraftid: REMOTE_ID, ifliveryid: null }); });
    expect(await runIfLivePublisher()).toMatchObject({ published: 0, states: { failed: 1 } });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not publish with a token from a previous connection", async () => {
    mocks.token.mockResolvedValue({ token: "previous-access", credential: "previous-credential", owner: 9, organizationId: UUID });
    expect(await runIfLivePublisher()).toMatchObject({ published: 0, states: { queued: 1 } });
    expect(mocks.binding).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });

  it("blocks an external earlier leg that would leave the aircraft at the wrong airport", async () => {
    const payload = buildIfPayload(flight, [{ userId: UUID, role: 0 }]);
    mocks.schedules.mockReset().mockResolvedValue([{ ...payload.schedule, id: REMOTE_ID, aircraftId: UUID, organizationId: UUID, status: 1, crew: [], briefing: "External", originIcao: "CYYZ", destinationIcao: "KJFK", scheduledDepartureUtc: "2026-10-04T05:00:00Z", scheduledArrivalUtc: "2026-10-04T08:00:00Z" }]);
    expect(await runIfLivePublisher()).toMatchObject({ published: 0, states: { conflict: 1 } });
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });

  it("selects eligible aircraft before limiting the oldest queue window", async () => {
    await runIfLivePublisher();
    const [sql, options] = selectionQueries()[0];
    expect(sql).toContain("IS_FREE_LOCK(CONCAT('wnc_if_aircraft_', current_flight.live_aircraft_id)) = 1");
    expect(sql).toContain("earlier_flight.scheduled_departure < current_flight.scheduled_departure");
    expect(sql).toContain("earlier_job.state <> 'done'");
    expect(String(sql).indexOf("NOT EXISTS")).toBeLessThan(String(sql).indexOf("LIMIT :limit"));
    expect(options).toMatchObject({ mapToModel: true, replacements: { limit: 10, maxAttempts: 5 } });
  });

  it("continues to another candidate batch after an aircraft lock race", async () => {
    const busy = { ...job, id: 2, flight_id: 2 };
    const query = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation(async (sql: string, options: any) => {
      if (sql.includes("FROM if_live_outbox AS pending")) return !options.replacements.attemptedIds.includes(busy.id) ? [busy] : !options.replacements.attemptedIds.includes(job.id) ? [job] : [];
      if (sql.includes("GET_LOCK") && options.replacements.lockName === "wnc_if_aircraft_8") return [{ acquired: 0 }];
      return query(sql, options);
    });
    mocks.liveFlight.findByPk.mockImplementation(async (id: number) => id === busy.flight_id ? { ...flight, id, live_aircraft_id: 8 } : flight);
    expect(await runIfLivePublisher()).toMatchObject({ processed: 1, published: 1 });
    expect(selectionQueries()[1][1].replacements.attemptedIds).toEqual([busy.id]);
    expect(mocks.outbox.findByPk).not.toHaveBeenCalledWith(busy.id, expect.anything());
    expect(lockTransaction.commit).toHaveBeenCalledTimes(2);
  });

  it("rechecks predecessors under the mutation mutex after selection", async () => {
    mocks.liveFlight.findAll.mockResolvedValue([{ id: 99 }]);
    mocks.outbox.count.mockResolvedValue(1);
    expect(await runIfLivePublisher()).toMatchObject({ processed: 0, published: 0 });
    expect(job.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("RELEASE_LOCK"))).toBe(true);
  });

  it("uses the current flight times when checking a predecessor after selection", async () => {
    const amendedDeparture = new Date("2026-10-04T12:00:00Z");
    mocks.liveFlight.findByPk.mockImplementation(async (_id: number, options: any) => options?.transaction ? { ...flight, scheduled_departure: amendedDeparture } : flight);
    mocks.liveFlight.findAll.mockResolvedValue([{ id: 99 }]); mocks.outbox.count.mockResolvedValue(1);
    expect(await runIfLivePublisher()).toMatchObject({ processed: 0 });
    const lookup = mocks.liveFlight.findAll.mock.calls[0][0];
    expect(lookup.where.scheduled_departure[Op.lt]).toEqual(amendedDeparture);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("retires superseded queued jobs without a lease or IF work", async () => {
    flight.revision = 2;
    expect(await runIfLivePublisher()).toMatchObject({ processed: 0, published: 0 });
    expect(job.update).toHaveBeenCalledWith({ state: "done", lease_until: null }, expect.objectContaining({ transaction: lockTransaction }));
    expect(job.attempts).toBe(0);
    expect(mocks.token).not.toHaveBeenCalled();
  });

  it.each(["processing", "done"])("does not reclaim a job another worker changed to %s", async state => {
    mocks.outbox.findByPk.mockImplementation(async () => ({ ...job, state }));
    expect(await runIfLivePublisher()).toMatchObject({ processed: 0 });
    expect(job.update).not.toHaveBeenCalled(); expect(mocks.token).not.toHaveBeenCalled();
  });

  it("does not reclaim delayed or exhausted jobs after selection", async () => {
    mocks.outbox.findByPk.mockImplementation(async () => ({ ...job, next_attempt_at: new Date(Date.now() + 60_000), attempts: 5 }));
    expect(await runIfLivePublisher()).toMatchObject({ processed: 0 });
    expect(job.update).not.toHaveBeenCalled(); expect(mocks.token).not.toHaveBeenCalled();
  });

  it("bounds reselection when every candidate loses its aircraft lock", async () => {
    const query = mocks.query.getMockImplementation()!;
    let selections = 0;
    mocks.query.mockImplementation(async (sql: string, options: any) => {
      if (sql.includes("FROM if_live_outbox AS pending")) return Array.from({ length: 10 }, () => ({ ...job, id: ++selections }));
      if (sql.includes("GET_LOCK")) return [{ acquired: 0 }];
      return query(sql, options);
    });
    expect(await runIfLivePublisher()).toMatchObject({ processed: 0 });
    expect(selectionQueries()).toHaveLength(3);
    expect(lockTransaction.commit).toHaveBeenCalledTimes(30);
    expect(mocks.token).not.toHaveBeenCalled();
  });

  it("keeps the two-job limit while retiring multiple obsolete candidates", async () => {
    const candidates = Array.from({ length: 5 }, (_, index) => ({ ...job, id: index + 1, flight_id: index + 1, revision: index < 2 ? 0 : 1, update: vi.fn(async function(this: any, values: any) { Object.assign(this, values); return this; }) }));
    const query = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation(async (sql: string, options: any) => sql.includes("FROM if_live_outbox AS pending") ? candidates.filter(row => !options.replacements.attemptedIds.includes(row.id)) : query(sql, options));
    mocks.outbox.findByPk.mockImplementation(async (id: number) => candidates.find(row => row.id === id));
    mocks.liveFlight.findByPk.mockImplementation(async (id: number) => ({ ...flight, id }));
    mocks.access.mockResolvedValue(false);
    expect(await runIfLivePublisher()).toMatchObject({ processed: 2, published: 0, states: { failed: 2 } });
    expect(candidates[0].state).toBe("done"); expect(candidates[1].state).toBe("done");
    expect(candidates[4].update).not.toHaveBeenCalled();
  });
});

// Exercise the actual eligibility SQL and advisory-lock visibility when an
// explicitly isolated MySQL test database is supplied. Never use app DB vars.
describe.runIf(Boolean(process.env.SCHEDULING_TEST_DATABASE_URL?.trim()))("IF publisher candidate selection on isolated MySQL", () => {
  let sqlDatabase: Sequelize;
  let sqlTransaction: Transaction;
  const busyTail = 1_900_000_000 + Math.floor(Math.random() * 1_000_000);
  const healthyTail = busyTail + 1;
  const flightTables = ["live_flights", "publisher_flights_1", "publisher_flights_2", "publisher_flights_3"];
  const outboxTables = ["if_live_outbox", "publisher_outbox_1", "publisher_outbox_2", "publisher_outbox_3"];
  function isolatedCandidateSql(sql: string) {
    // MySQL cannot reference one TEMPORARY table twice in a SELECT. Give each
    // table reference an identical fixture copy; retain the production query's
    // joins, predicates, ordering, limits, binds, and actual lock functions.
    let flights = 0; let outboxes = 0;
    return sql.replace(/\blive_flights AS\b/g, () => `${flightTables[flights++]} AS`)
      .replace(/\bif_live_outbox AS\b/g, () => `${outboxTables[outboxes++]} AS`);
  }
  async function copyFixtureTables() {
    for (const tables of [flightTables, outboxTables]) for (const table of tables.slice(1)) {
      await sqlDatabase.query(`DELETE FROM ${table}`, { transaction: sqlTransaction });
      await sqlDatabase.query(`INSERT INTO ${table} SELECT * FROM ${tables[0]}`, { transaction: sqlTransaction });
    }
  }

  beforeAll(async () => {
    const databaseUrl = process.env.SCHEDULING_TEST_DATABASE_URL!.trim();
    const parsed = new URL(databaseUrl);
    if (parsed.protocol !== "mysql:" || !/^webncrew_scheduling_test_[a-z0-9_]+$/i.test(decodeURIComponent(parsed.pathname.slice(1))) ||
        (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) && process.env.SCHEDULING_TEST_ALLOW_REMOTE !== "true")) {
      throw new Error("Publisher SQL tests require an isolated webncrew_scheduling_test_* MySQL database; remote hosts also require SCHEDULING_TEST_ALLOW_REMOTE=true");
    }
    sqlDatabase = new Sequelize(databaseUrl, { logging: false, pool: { max: 2, min: 0 }, retry: { max: 0 } });
    sqlTransaction = await sqlDatabase.transaction();
    // Temporary tables shadow these names only on this pinned connection.
    await sqlDatabase.query("CREATE TEMPORARY TABLE live_flights (id INT PRIMARY KEY, live_aircraft_id INT NOT NULL, revision INT NOT NULL, status VARCHAR(24) NOT NULL, scheduled_departure DATETIME(3) NOT NULL, KEY flight_queue (live_aircraft_id, status, scheduled_departure))", { transaction: sqlTransaction });
    await sqlDatabase.query("CREATE TEMPORARY TABLE if_live_outbox (id INT PRIMARY KEY, flight_id INT NOT NULL, revision INT NOT NULL, state VARCHAR(24) NOT NULL, attempts INT NOT NULL, next_attempt_at DATETIME(3) NOT NULL, created_at DATETIME(3) NOT NULL, KEY flight_revision (flight_id, revision), KEY ready (state, next_attempt_at))", { transaction: sqlTransaction });
    for (const tables of [flightTables, outboxTables]) for (const table of tables.slice(1)) await sqlDatabase.query(`CREATE TEMPORARY TABLE ${table} LIKE ${tables[0]}`, { transaction: sqlTransaction });
  }, 20_000);

  afterAll(async () => {
    try { if (sqlTransaction) await sqlTransaction.rollback(); }
    finally { if (sqlDatabase) await sqlDatabase.close(); }
  });

  beforeEach(async () => {
    await sqlDatabase.query("DELETE FROM if_live_outbox", { transaction: sqlTransaction });
    await sqlDatabase.query("DELETE FROM live_flights", { transaction: sqlTransaction });
  });

  async function arrangeWindow(options: { predecessor?: boolean; superseded?: boolean; removal?: boolean } = {}) {
    const jobs = Array.from({ length: 11 }, (_, index) => ({ ...job, id: index + 1, flight_id: index + 1,
      update: vi.fn(async function(this: any, values: any) { Object.assign(this, values); return this; }) }));
    const flights = jobs.map(row => ({ ...flight, id: row.flight_id, live_aircraft_id: row.id <= 10 ? busyTail : healthyTail,
      revision: options.superseded && row.id <= 10 ? 2 : 1 }));
    for (const row of flights) {
      await sqlDatabase.query("INSERT INTO live_flights VALUES (:id, :tail, :revision, 'approved', '2026-10-04 10:00:00')", { replacements: { id: row.id, tail: row.live_aircraft_id, revision: row.revision }, transaction: sqlTransaction });
      await sqlDatabase.query("INSERT INTO if_live_outbox VALUES (:id, :id, 1, 'queued', 0, '2000-01-01', :created)", { replacements: { id: row.id, created: new Date(1000 * row.id) }, transaction: sqlTransaction });
    }
    if (options.predecessor || options.removal) {
      await sqlDatabase.query("INSERT INTO live_flights VALUES (99, :tail, 1, :status, '2026-10-04 09:00:00')", { replacements: { tail: busyTail, status: options.removal ? "needs_review" : "approved" }, transaction: sqlTransaction });
      await sqlDatabase.query("INSERT INTO if_live_outbox VALUES (99, 99, 1, 'conflict', 1, '2000-01-01', '2000-01-01')", { transaction: sqlTransaction });
    }
    await copyFixtureTables();
    const query = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation(async (sql: string, queryOptions: any) => {
      if (!sql.includes("FROM if_live_outbox AS pending")) return query(sql, queryOptions);
      const rows = await sqlDatabase.query<{ id: number }>(isolatedCandidateSql(sql), { replacements: queryOptions.replacements, transaction: sqlTransaction, type: QueryTypes.SELECT });
      return rows.map(row => jobs.find(candidate => candidate.id === row.id)!);
    });
    // The previous implementation selected the first ten raw queued rows.
    mocks.outbox.findAll.mockImplementation(async (queryOptions: any) => queryOptions.where.state === "processing" ? [] : jobs.slice(0, queryOptions.limit));
    mocks.outbox.findByPk.mockImplementation(async (id: number) => jobs.find(row => row.id === id));
    mocks.liveFlight.findByPk.mockImplementation(async (id: number) => flights.find(row => row.id === id));
    mocks.liveFlight.findAll.mockImplementation(async (queryOptions: any) => queryOptions.attributes?.includes("scheduled_departure")
      ? options.removal && queryOptions.where.live_aircraft_id === busyTail ? [{ id: 99, scheduled_departure: new Date("2026-10-04T09:00:00Z") }] : []
      : typeof queryOptions.where.status === "object" ? [{ public_id: UUID }]
      : options.predecessor && queryOptions.where.live_aircraft_id === busyTail ? [{ id: 99 }] : []);
    mocks.outbox.count.mockImplementation(async (queryOptions: any) => (options.predecessor || options.removal) && typeof queryOptions.where.flight_id === "object" ? 1 : 0);
    mocks.access.mockResolvedValue(false); // No external IF requests in these selection tests.
    return jobs;
  }

  it("progresses the healthy eleventh job when the oldest ten have a conflicted predecessor", async () => {
    const jobs = await arrangeWindow({ predecessor: true });
    expect(await runIfLivePublisher()).toMatchObject({ processed: 1, states: { failed: 1 } });
    expect(jobs.slice(0, 10).every(row => row.update.mock.calls.length === 0)).toBe(true);
    expect(jobs[10].state).toBe("processing");
    expect(mocks.outbox.findByPk).toHaveBeenCalledWith(11, expect.anything());
  });

  it("skips an actual advisory lock covering the oldest ten jobs", async () => {
    const jobs = await arrangeWindow();
    const holder = await sqlDatabase.transaction();
    const lockName = `wnc_if_aircraft_${busyTail}`;
    try {
      const acquired = await sqlDatabase.query<{ acquired: number }>("SELECT GET_LOCK(:lockName, 0) AS acquired", { replacements: { lockName }, type: QueryTypes.SELECT, transaction: holder });
      expect(Number(acquired[0].acquired)).toBe(1);
      expect(await runIfLivePublisher()).toMatchObject({ processed: 1 });
      expect(jobs.slice(0, 10).every(row => row.update.mock.calls.length === 0)).toBe(true);
      expect(mocks.outbox.findByPk).toHaveBeenCalledWith(11, expect.anything());
    } finally {
      try { await sqlDatabase.query("SELECT RELEASE_LOCK(:lockName)", { replacements: { lockName }, transaction: holder }); }
      finally { await holder.rollback(); }
    }
  });

  it("retires ten stale revisions then reaches a healthy job beyond the batch", async () => {
    const jobs = await arrangeWindow({ predecessor: true, superseded: true });
    expect(await runIfLivePublisher()).toMatchObject({ processed: 1 });
    expect(jobs.slice(0, 10).every(row => row.state === "done" && row.attempts === 0)).toBe(true);
    expect(jobs[10].state).toBe("processing");
    expect(selectionQueries()).toHaveLength(3);
  });

  it("blocks approved jobs behind any conflicted removal without blocking another aircraft", async () => {
    const jobs = await arrangeWindow({ removal: true });
    expect(await runIfLivePublisher()).toMatchObject({ processed: 1 });
    expect(jobs.slice(0, 10).every(row => row.update.mock.calls.length === 0)).toBe(true);
    expect(mocks.outbox.findByPk).toHaveBeenCalledWith(11, expect.anything());
  });

  it("selects removals downstream first, including a tied departure's larger flight ID", async () => {
    const jobs = await arrangeWindow();
    await sqlDatabase.query("UPDATE live_flights SET status = 'needs_review' WHERE id <= 10", { transaction: sqlTransaction });
    await copyFixtureTables();
    // Keep the winning removal queued so each SQL selection observes the same
    // dependency gate; the invocation's exclusions avoid repeatedly claiming it.
    mocks.outbox.findByPk.mockImplementation(async (id: number) => id === 10 ? { ...jobs[9], state: "processing" } : jobs.find(row => row.id === id));
    expect(await runIfLivePublisher()).toMatchObject({ processed: 1 });
    const firstCandidates = await sqlDatabase.query<{ id: number }>(isolatedCandidateSql(selectionQueries()[0][0]), { replacements: selectionQueries()[0][1].replacements, transaction: sqlTransaction, type: QueryTypes.SELECT });
    expect(firstCandidates.map(row => row.id)).toEqual([10, 11]);
    expect(mocks.outbox.findByPk).not.toHaveBeenCalledWith(9, expect.anything());
    expect(mocks.outbox.findByPk).toHaveBeenCalledWith(10, expect.anything());
  });
});

describe("IF cascade removal queue claims", () => {
  const removalLookup = (options: any) => options.attributes?.includes("scheduled_departure");

  it.each(["queued", "failed", "conflict", "reconciliation"])("rechecks a %s removal before claiming an approved flight", async state => {
    const original = mocks.liveFlight.findAll.getMockImplementation()!;
    mocks.liveFlight.findAll.mockImplementation(async (options: any) => removalLookup(options) ? [{ id: 99, scheduled_departure: new Date("2026-10-05T10:00:00Z"), state }] : original(options));
    mocks.outbox.count.mockImplementation(async (options: any) => options.where.flight_id?.[Op.in]?.includes(99) ? 1 : 0);
    expect(await runIfLivePublisher()).toMatchObject({ processed: 0 });
    expect(job.update).not.toHaveBeenCalled(); expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.outbox.count).toHaveBeenCalledWith(expect.objectContaining({ where: { flight_id: { [Op.in]: [99] }, state: { [Op.ne]: "done" } } }));
  });

  it.each([
    { id: 99, departure: "2026-10-04T11:00:00Z" },
    { id: 99, departure: "2026-10-04T10:00:00Z" },
  ])("waits for downstream removal $id at $departure before deleting its predecessor", async ({ id, departure }) => {
    flight.status = "cancelled";
    const original = mocks.liveFlight.findAll.getMockImplementation()!;
    mocks.liveFlight.findAll.mockImplementation(async (options: any) => removalLookup(options) ? [{ id, scheduled_departure: new Date(departure) }] : original(options));
    mocks.outbox.count.mockResolvedValue(1);
    expect(await runIfLivePublisher()).toMatchObject({ processed: 0 });
    expect(job.update).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("does not wait for an earlier removal before clearing the last downstream flight", async () => {
    flight.status = "cancelled";
    mocks.schedules.mockReset().mockResolvedValue([]);
    const original = mocks.liveFlight.findAll.getMockImplementation()!;
    mocks.liveFlight.findAll.mockImplementation(async (options: any) => removalLookup(options) ? [{ id: 99, scheduled_departure: new Date("2026-10-04T09:00:00Z") }] : original(options));
    mocks.outbox.count.mockImplementation(async (options: any) => typeof options.where.flight_id === "object" ? 1 : 0);
    expect(await runIfLivePublisher()).toMatchObject({ processed: 1, published: 1 });
    expect(job.update).toHaveBeenCalledWith(expect.objectContaining({ state: "processing" }), expect.anything());
  });

  it("does not wait for completed removal jobs", async () => {
    const original = mocks.liveFlight.findAll.getMockImplementation()!;
    mocks.liveFlight.findAll.mockImplementation(async (options: any) => removalLookup(options) ? [{ id: 99, scheduled_departure: new Date("2026-10-05T10:00:00Z") }] : original(options));
    mocks.outbox.count.mockResolvedValue(0);
    expect(await runIfLivePublisher()).toMatchObject({ processed: 1, published: 1 });
  });

  it("retires stale jobs even while their aircraft has a blocked removal", async () => {
    job.revision = 0;
    mocks.liveFlight.findAll.mockResolvedValue([{ id: 99, scheduled_departure: new Date("2026-10-05T10:00:00Z") }]);
    mocks.outbox.count.mockResolvedValue(1);
    expect(await runIfLivePublisher()).toMatchObject({ processed: 0 });
    expect(job.update).toHaveBeenCalledWith({ state: "done", lease_until: null }, expect.anything());
    expect(mocks.outbox.count).not.toHaveBeenCalled();
  });
});
