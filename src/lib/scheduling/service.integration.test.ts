import { isAbsolute } from "node:path";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Sequelize, QueryTypes } from "sequelize";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Opt in with a dedicated disposable PostgreSQL database. The suite owns only
// its uniquely named schema, and never reads production DB_* credentials.
const suppliedUrl = process.env.SCHEDULING_TEST_DATABASE_URL;

function remoteTestTlsAllowed(target: URL) {
  return process.env.SCHEDULING_TEST_ALLOW_REMOTE === "1"
    && target.searchParams.get("sslmode") === "verify-full"
    && isAbsolute(target.searchParams.get("sslrootcert") || "");
}
function isolatedTarget(raw: string) {
  const target = new URL(raw);
  const database = decodeURIComponent(target.pathname.slice(1));
  if (!["postgres:", "postgresql:"].includes(target.protocol) || !/^webncrew_scheduling_test_[a-z0-9_]+$/i.test(database)) {
    throw new Error("Scheduling integration tests require a dedicated PostgreSQL database named webncrew_scheduling_test_<name>");
  }
  const isLoopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(target.hostname);
  if (!isLoopback && !remoteTestTlsAllowed(target)) {
    throw new Error("Scheduling integration tests require loopback; remote tests require SCHEDULING_TEST_ALLOW_REMOTE=1, sslmode=verify-full and an absolute sslrootcert path");
  }
  return { url: target.toString(), database, isLoopback };
}

describe.skipIf(!suppliedUrl)("PostgreSQL live scheduling transaction concurrency", () => {
  let database: Sequelize;
  let base: typeof import("@/lib/models").models;
  let live: typeof import("./models");
  let service: typeof import("./service");
  let settings: typeof import("./settings");
  let lockNamespace: number;
  let schedulingMutexWaitMs = 3_000;
  let mayCleanUp = false;
  const schema = `crew_service_test_${randomUUID().replaceAll("-", "")}`;
  const captain = { id: 1, admin: false };
  const administrator = { id: 9, admin: true };
  const at = (hour: number) => new Date(`2026-10-02T${String(hour).padStart(2, "0")}:00:00Z`);
  let resetSequences: string;

  beforeAll(async () => {
    const target = isolatedTarget(suppliedUrl!);
    schedulingMutexWaitMs = target.isLoopback ? 3_000 : 15_000;
    database = new Sequelize(target.url, {
      dialect: "postgres", logging: false, timezone: "+00:00",
      pool: { min: 0, max: 8 },
      dialectOptions: { options: `-c search_path=${schema},public`, ...(target.isLoopback ? { ssl: false } : {}) },
    });
    await database.authenticate();
    const selected = await database.query<{ name: string }>("SELECT current_database() AS name", { type: QueryTypes.SELECT });
    if (selected[0]?.name !== target.database) throw new Error("The test connection selected an unexpected database");
    await database.query(`CREATE SCHEMA "${schema}"`);
    mayCleanUp = true;
    await database.query(await readFile(new URL("../../../migrations/postgresql/001_baseline.sql", import.meta.url), "utf8"));
    resetSequences = await readFile(new URL("../../../migrations/postgresql/002_reset_identity_sequences.sql", import.meta.url), "utf8");

    vi.doMock("@/lib/database", () => ({ default: database }));
    base = (await import("@/lib/models")).models;
    live = await import("./models");
    service = await import("./service");
    settings = await import("./settings");
    lockNamespace = (await import("./if-aircraft-lock")).IF_AIRCRAFT_LOCK_NAMESPACE;
    vi.stubEnv("LIVE_PILOT_AWARD_ID", "7");
    vi.stubEnv("IF_LIVE_AUTO_PUBLISH_ENABLED", "false");
  }, 30_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    if (database) {
      try {
        if (mayCleanUp) await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      } finally { await database.close(); }
    }
    vi.doUnmock("@/lib/database");
  }, 30_000);

  beforeEach(async () => {
    const tables = await database.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = :schema AND tablename <> 'options'",
      { replacements: { schema }, type: QueryTypes.SELECT },
    );
    const quotedTables = tables.map(({ tablename }) => `"${schema}"."${tablename.replaceAll('"', '""')}"`);
    await database.query(`TRUNCATE TABLE ${quotedTables.join(", ")} RESTART IDENTITY CASCADE`);
    await database.query("DELETE FROM options WHERE name = :name", { replacements: { name: "live_scheduling_allow_unpublished_if_starts" } });
    await base.Pilot.bulkCreate([1, 2, 3, 4, 5, 9].map(id => ({
      id, name: `Test Pilot ${id}`, callsign: `TEST${id}`, ifc: `test${id}`,
      email: `pilot${id}@example.com`, password: "unused-test-password", status: 1,
    })));
    await base.Award.create({ id: 7, name: "Live Pilot", description: "Test gate", imageurl: "https://example.com/award.png" });
    await base.Permission.create({ userid: 9, name: "scheduling" });
    await base.AwardGranted.bulkCreate([1, 2, 3, 4, 5].map(pilotid => ({ pilotid, awardid: 7, dateawarded: "2026-10-02" })));
    await base.Aircraft.create({ id: 1, name: "Test A350", status: 1 });
    await live.LiveAircraft.bulkCreate([
      { id: 1, registration: "C-TEST1", aircraft_id: 1, current_airport: "CYYZ" },
      { id: 2, registration: "C-TEST2", aircraft_id: 1, current_airport: "CYYZ" },
    ]);
    await database.query(resetSequences);
  }, 15_000);

  async function flight(overrides: Record<string, unknown> = {}) {
    const aircraftId = Number(overrides.live_aircraft_id ?? 1);
    const last = await live.LiveFlight.findOne({ where: { live_aircraft_id: aircraftId }, order: [["queue_order", "DESC NULLS LAST"]] });
    return live.LiveFlight.create({
      public_id: randomUUID(), live_aircraft_id: 1, captain_id: 1,
      departure: "CYYZ", arrival: "KJFK", scheduled_departure: at(10), scheduled_arrival: at(12),
      queue_order: overrides.status === "pending" ? null : Number(last?.queue_order ?? 0) + 1,
      status: "approved", ...overrides,
    });
  }

  it("enforces the imported queue, time-pair and flight-type constraints", async () => {
    const one = await flight();
    const two = await flight({ departure: "KJFK", arrival: "EGLL" });
    for (const changes of ["queue_order = NULL", "scheduled_arrival = NULL", "queue_order = -1", "flight_type = 'Commercial'", "flight_type = 'other '"]) {
      await expect(database.query(`UPDATE live_flights SET ${changes} WHERE id = :id`, { replacements: { id: one.id } }))
        .rejects.toMatchObject({ original: { code: "23514" } });
    }
    await expect(database.query("UPDATE live_flights SET queue_order = :order WHERE id = :id", { replacements: { order: two.queue_order, id: one.id } }))
      .rejects.toMatchObject({ original: { code: "23505" } });
    await expect(database.query("UPDATE live_flights SET flight_type = NULL WHERE id = :id", { replacements: { id: one.id } }))
      .rejects.toMatchObject({ original: { code: "23502" } });
    await expect(flight({ scheduled_departure: null, scheduled_arrival: null })).resolves.toBeDefined();
    expect((await live.LiveFlight.findByPk(one.id))?.flight_type).toBe("commercial");
  });

  it("resets identities after explicit imports and retains the auth column casing", async () => {
    await base.Pilot.create({ id: 4500, callsign: "IMPORTED", name: "Imported", ifc: "Imported", email: "Imported@example.com", password: "preserved-hash", status: 3 });
    await database.query(resetSequences);
    const pilot = await base.Pilot.create({ callsign: "NEW", name: "New", ifc: "New", email: "new@example.com", password: "unchanged-hash", status: 3 });
    expect(pilot.id).toBe(4501);
    expect(pilot.status).toBe(3);
    const expiresAt = new Date("2026-11-01T05:30:00.000Z");
    const token = await base.Token.create({ pilotId: pilot.id, token: "rehearsal-token", expiresAt });
    expect((await base.Token.findByPk(token.id))?.toJSON()).toMatchObject({ pilotId: pilot.id, token: "rehearsal-token", expiresAt, isRevoked: false });
    const timezone = await database.query<{ offset_seconds: number }>("SELECT EXTRACT(TIMEZONE FROM CURRENT_TIMESTAMP)::integer AS offset_seconds", { type: QueryTypes.SELECT });
    expect(timezone[0].offset_seconds).toBe(0);
  });

  it("round-trips calendar dates without shifting them across midnight", async () => {
    const pirep = await base.Pirep.create({ flightnum: "DATE1", departure: "CYYZ", arrival: "KJFK", flighttime: 3600, pilotid: 1, date: "2026-11-01", aircraftid: 1, fuelused: 100, multi: "", status: 0 });
    expect((await base.Pirep.findByPk(pirep.id))?.date).toBe("2026-11-01");
    const award = await base.AwardGranted.create({ pilotid: 9, awardid: 7, dateawarded: "2026-11-01" });
    expect((await base.AwardGranted.findByPk(award.id))?.dateawarded).toBe("2026-11-01");
  });

  it("persists requested and amended flight types and rejects invalid API submissions without mutation", async () => {
    const freight = await service.requestFlight(captain, { live_aircraft_id: 1, arrival: "KJFK", flight_type: "freight" });
    expect((await live.LiveFlight.findByPk(freight.flight_id))?.flight_type).toBe("freight");
    await service.changeFlight(captain, { flight_id: freight.flight_id, action: "edit", notes: "No type change" });
    await service.changeFlight(administrator, { flight_id: freight.flight_id, action: "approve" });
    expect((await live.LiveFlight.findByPk(freight.flight_id))?.flight_type).toBe("freight");
    await service.changeFlight(administrator, { flight_id: freight.flight_id, action: "amend", flight_type: "ferry" });
    expect((await live.LiveFlight.findByPk(freight.flight_id))?.flight_type).toBe("ferry");
    const audits = await live.LiveScheduleEvent.findAll({ where: { flight_id: freight.flight_id, action: "amend" }, raw: true });
    expect(audits[0]).toMatchObject({ details: { before: { flight_type: "freight" }, after: { flight_type: "ferry" } } });
    await expect(service.changeFlight(administrator, { flight_id: freight.flight_id, action: "amend", flight_type: "unknown" })).rejects.toMatchObject({ status: 400 });
    expect((await live.LiveFlight.findByPk(freight.flight_id))?.flight_type).toBe("ferry");
    await expect(service.requestFlight(captain, { live_aircraft_id: 1, arrival: "KBOS", flight_type: "unknown" })).rejects.toMatchObject({ status: 400 });
    expect(await live.LiveFlight.count()).toBe(1);
    const commercial = await service.requestFlight(captain, { live_aircraft_id: 1, arrival: "KBOS" });
    expect((await live.LiveFlight.findByPk(commercial.flight_id))?.flight_type).toBe("commercial");
  });

  it("appends consecutive untimed approvals with unique queue positions under concurrent requests", async () => {
    const one = await flight({ status: "pending", scheduled_departure: null, scheduled_arrival: null });
    const two = await flight({ status: "pending", captain_id: 2, departure: "KJFK", arrival: "KBOS", scheduled_departure: null, scheduled_arrival: null });
    let locked!: () => void, release!: () => void;
    const lockReady = new Promise<void>(resolve => { locked = resolve; });
    const allowCommit = new Promise<void>(resolve => { release = resolve; });
    const original = live.LiveAircraft.findByPk.bind(live.LiveAircraft);
    let holdFirst = true;
    const observer = vi.spyOn(live.LiveAircraft, "findByPk").mockImplementation(async (id, options) => {
      const result = await original(id, options);
      if (id === 1 && options?.lock && holdFirst) { holdFirst = false; locked(); await allowCommit; }
      return result;
    });
    const first = service.changeFlight(administrator, { flight_id: one.id, action: "approve" });
    void first.catch(() => { locked(); });
    try {
      await lockReady;
      const second = service.changeFlight(administrator, { flight_id: two.id, action: "approve" });
      release();
      const results = await Promise.allSettled([first, second]);
      expect(results.every(result => result.status === "fulfilled")).toBe(true);
      expect((await live.LiveFlight.findAll({ order: [["queue_order", "ASC"]] })).map(row => ({ order: row.queue_order, departure: row.scheduled_departure }))).toEqual([{ order: 1, departure: null }, { order: 2, departure: null }]);
    } finally { release(); observer.mockRestore(); await Promise.allSettled([first]); }
  });

  it("allows concurrent untimed captain commitments across different aircraft", async () => {
    const one = await flight({ status: "pending", scheduled_departure: null, scheduled_arrival: null });
    const two = await flight({ live_aircraft_id: 2, status: "pending", scheduled_departure: null, scheduled_arrival: null });
    const results = await Promise.allSettled([
      service.changeFlight(administrator, { flight_id: one.id, action: "approve" }),
      service.changeFlight(administrator, { flight_id: two.id, action: "approve" }),
    ]);
    expect(results.every(result => result.status === "fulfilled")).toBe(true);
    expect(await live.LiveFlight.count({ where: { status: "approved" } })).toBe(2);
  });

  it("allows concurrent untimed crew assignments on different aircraft", async () => {
    const one = await flight({ scheduled_departure: null, scheduled_arrival: null });
    const two = await flight({ live_aircraft_id: 2, captain_id: 2, scheduled_departure: null, scheduled_arrival: null });
    const first = await live.LiveFlightMember.create({ flight_id: one.id, pilot_id: 3 });
    const second = await live.LiveFlightMember.create({ flight_id: two.id, pilot_id: 3 });
    const results = await Promise.allSettled([
      service.changeFlight(captain, { flight_id: one.id, member_id: first.id, action: "approve_join" }),
      service.changeFlight({ id: 2, admin: false }, { flight_id: two.id, member_id: second.id, action: "approve_join" }),
    ]);
    expect(results.every(result => result.status === "fulfilled")).toBe(true);
    expect(await live.LiveFlightMember.count({ where: { pilot_id: 3, status: "approved" } })).toBe(2);
  });

  it.each(["captain", "crew"])("starts both aircraft independently for a shared %s while preserving each aircraft's queue and location", async role => {
    const one = await flight({ scheduled_departure: null, scheduled_arrival: null });
    const two = await flight({ live_aircraft_id: 2, captain_id: role === "captain" ? 1 : 2, scheduled_departure: null, scheduled_arrival: null });
    if (role === "crew") await live.LiveFlightMember.bulkCreate([
      { flight_id: one.id, pilot_id: 3, status: "approved" },
      { flight_id: two.id, pilot_id: 3, status: "approved" },
    ]);
    const results = await Promise.allSettled([
      service.changeFlight(administrator, { flight_id: one.id, action: "start" }),
      service.changeFlight(administrator, { flight_id: two.id, action: "start" }),
    ]);
    expect(results.every(result => result.status === "fulfilled")).toBe(true);
    expect(await live.LiveFlight.count({ where: { status: "in_progress" } })).toBe(2);
    expect((await live.LiveFlight.findByPk(one.id))?.actual_departure_at).toBeInstanceOf(Date);
    expect((await live.LiveFlight.findByPk(two.id))?.actual_departure_at).toBeInstanceOf(Date);
    expect((await live.LiveAircraft.findByPk(1))?.current_airport).toBe("CYYZ");
    expect((await live.LiveAircraft.findByPk(2))?.current_airport).toBe("CYYZ");

    const next = await flight({ departure: "KJFK", arrival: "KBOS", scheduled_departure: null, scheduled_arrival: null });
    await expect(service.changeFlight(administrator, { flight_id: next.id, action: "start" })).rejects.toThrow("Finish the aircraft's preceding flight first");
    await service.changeFlight(administrator, { flight_id: one.id, action: "complete", actual_arrival: "KJFK" });
    expect((await live.LiveFlight.findByPk(two.id))?.status).toBe("in_progress");
    expect((await live.LiveAircraft.findByPk(1))?.current_airport).toBe("KJFK");
    expect((await live.LiveAircraft.findByPk(2))?.current_airport).toBe("CYYZ");
    await service.changeFlight(administrator, { flight_id: next.id, action: "start" });
    expect(await live.LiveFlight.count({ where: { status: "in_progress" } })).toBe(2);
    await service.changeFlight(administrator, { flight_id: two.id, action: "complete", actual_arrival: "EGLL" });
    expect((await live.LiveFlight.findByPk(next.id))?.status).toBe("in_progress");
    expect((await live.LiveAircraft.findByPk(1))?.current_airport).toBe("KJFK");
    expect((await live.LiveAircraft.findByPk(2))?.current_airport).toBe("EGLL");
    expect(await live.LiveFlight.count({ where: { status: "completed" } })).toBe(2);
  });

  it("keeps untimed queue order through diversion, repair, reapproval and actual arrival", async () => {
    const one = await flight({ scheduled_departure: null, scheduled_arrival: null });
    const two = await flight({ departure: "KJFK", arrival: "EGLL", scheduled_departure: null, scheduled_arrival: null });
    await expect(service.changeFlight(captain, { flight_id: two.id, action: "start" })).rejects.toMatchObject({ status: 409 });
    await service.changeFlight(captain, { flight_id: one.id, action: "start" });
    await service.changeFlight(captain, { flight_id: one.id, action: "complete", actual_arrival: "KBOS" });
    expect((await live.LiveFlight.findByPk(two.id))?.status).toBe("needs_review");
    expect((await live.LiveFlight.findByPk(two.id))?.queue_order).toBe(2);
    await service.changeFlight(administrator, { flight_id: two.id, action: "amend", departure: "KBOS" });
    expect((await live.LiveFlight.findByPk(two.id))?.queue_order).toBe(2);
    await service.changeFlight(captain, { flight_id: two.id, action: "start" });
    await service.changeFlight(captain, { flight_id: two.id, action: "complete", actual_arrival: "EGLL" });
    expect((await live.LiveAircraft.findByPk(1))?.current_airport).toBe("EGLL");
    const next = await service.requestFlight(captain, { live_aircraft_id: 1, arrival: "LFPG" });
    await service.changeFlight(administrator, { flight_id: next.flight_id, action: "approve" });
    expect((await live.LiveFlight.findByPk(next.flight_id))?.queue_order).toBe(3);
  });

  it("starts by reserved queue order even when another flight has an earlier planned time", async () => {
    const one = await flight();
    const two = await flight({ departure: "KJFK", arrival: "KBOS", scheduled_departure: at(7), scheduled_arrival: at(8) });
    await expect(service.changeFlight(captain, { flight_id: two.id, action: "start" })).rejects.toMatchObject({ status: 409 });
    await service.changeFlight(captain, { flight_id: one.id, action: "start" });
    expect((await live.LiveFlight.findByPk(one.id))?.status).toBe("in_progress");
  });
  function expectOneWinner(results: PromiseSettledResult<unknown>[]) {
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: 409 });
  }

  it("blocks mutations on an IF-linked aircraft while an IF editor holds its advisory lock", async () => {
    await live.LiveAircraft.update({ if_aircraft_id: "10000000-0000-0000-0000-000000000001" }, { where: { id: 1 } });
    const lease = await database.transaction();
    try {
      const acquired = await database.query<{ acquired: boolean }>("SELECT pg_try_advisory_xact_lock(:namespace, :aircraftId) AS acquired", { replacements: { namespace: lockNamespace, aircraftId: 1 }, type: QueryTypes.SELECT, transaction: lease });
      expect(acquired[0]?.acquired).toBe(true);
      const proposal = { live_aircraft_id: 1, arrival: "KJFK", scheduled_departure: at(10).toISOString(), scheduled_arrival: at(12).toISOString() };
      await expect(service.requestFlight(captain, proposal)).rejects.toMatchObject({ status: 409 });
      expect(await live.LiveFlight.count()).toBe(0);
      expect(await live.LiveScheduleEvent.count()).toBe(0);
      // The writer's aircraft lock must not block another aircraft's local queue.
      await service.requestFlight(captain, { ...proposal, live_aircraft_id: 2 });
      expect(await live.LiveFlight.count()).toBe(1);
    } finally {
      await lease.commit();
    }
    await service.requestFlight(captain, { live_aircraft_id: 1, arrival: "KJFK", scheduled_departure: at(10).toISOString(), scheduled_arrival: at(12).toISOString() });
    expect(await live.LiveFlight.count()).toBe(2);
  });

  it("allows exactly one of two concurrent overlapping aircraft approvals", async () => {
    const one = await flight({ status: "pending" });
    const two = await flight({ captain_id: 2, status: "pending" });
    expectOneWinner(await Promise.allSettled([
      service.changeFlight(administrator, { flight_id: one.id, action: "approve" }),
      service.changeFlight(administrator, { flight_id: two.id, action: "approve" }),
    ]));
    expect(await live.LiveFlight.count({ where: { status: "approved" } })).toBe(1);
    expect(await live.LiveFlight.count({ where: { status: "pending" } })).toBe(1);
  });

  it("allocates the final crew seat once under concurrent approvals", async () => {
    const schedule = await flight();
    await live.LiveFlightMember.create({ flight_id: schedule.id, pilot_id: 2, status: "approved" });
    const one = await live.LiveFlightMember.create({ flight_id: schedule.id, pilot_id: 3 });
    const two = await live.LiveFlightMember.create({ flight_id: schedule.id, pilot_id: 4 });
    expectOneWinner(await Promise.allSettled([
      service.changeFlight(captain, { flight_id: schedule.id, member_id: one.id, action: "approve_join" }),
      service.changeFlight(captain, { flight_id: schedule.id, member_id: two.id, action: "approve_join" }),
    ]));
    expect(await live.LiveFlightMember.count({ where: { flight_id: schedule.id, status: "approved" } })).toBe(2);
  });

  it("prevents concurrent crew approval from booking a pilot on two tails", async () => {
    const one = await flight();
    const two = await flight({ live_aircraft_id: 2, captain_id: 2 });
    const firstRequest = await live.LiveFlightMember.create({ flight_id: one.id, pilot_id: 3 });
    const secondRequest = await live.LiveFlightMember.create({ flight_id: two.id, pilot_id: 3 });
    expectOneWinner(await Promise.allSettled([
      service.changeFlight(captain, { flight_id: one.id, member_id: firstRequest.id, action: "approve_join" }),
      service.changeFlight({ id: 2, admin: false }, { flight_id: two.id, member_id: secondRequest.id, action: "approve_join" }),
    ]));
    expect(await live.LiveFlightMember.count({ where: { pilot_id: 3, status: "approved" } })).toBe(1);
  });

  it("rechecks the award after waiting for a concurrent revocation transaction", async () => {
    const schedule = await flight({ status: "pending" });
    let locked!: () => void;
    let release!: () => void;
    let attempted!: () => void;
    const lockReady = new Promise<void>(resolve => { locked = resolve; });
    const allowCommit = new Promise<void>(resolve => { release = resolve; });
    const lockAttempted = new Promise<void>(resolve => { attempted = resolve; });
    const revocation = database.transaction(async transaction => {
      await base.Pilot.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
      await base.AwardGranted.destroy({ where: { pilotid: 1, awardid: 7 }, transaction });
      locked();
      await allowCommit;
    });
    // Keep setup failures observable without leaving a blocked test transaction.
    void revocation.catch(() => { locked(); });
    await lockReady;
    const original = base.Pilot.findByPk.bind(base.Pilot);
    const observer = vi.spyOn(base.Pilot, "findByPk").mockImplementation((id, options) => {
      if (id === 1 && options?.lock) attempted();
      return original(id, options);
    });
    const approval = service.changeFlight(administrator, { flight_id: schedule.id, action: "approve" });
    void approval.catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        lockAttempted,
        new Promise<void>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error("Approval never attempted the held pilot lock")), 3_000);
        }),
      ]);
      release();
      await revocation;
      await expect(approval).rejects.toMatchObject({ status: 403 });
      expect((await live.LiveFlight.findByPk(schedule.id))?.status).toBe("pending");
      expect(await live.LiveScheduleEvent.count()).toBe(0);
    } finally {
      if (timer) clearTimeout(timer);
      release();
      observer.mockRestore();
      await Promise.allSettled([approval, revocation]);
    }
  });

  it("rolls back captain promotion and schedule changes when validation fails", async () => {
    const one = await flight();
    await flight({ live_aircraft_id: 2, captain_id: 2 });
    const crew = await live.LiveFlightMember.create({ flight_id: one.id, pilot_id: 2, status: "approved" });
    await expect(service.changeFlight(administrator, { flight_id: one.id, action: "reassign", captain_id: 2 })).rejects.toMatchObject({ status: 409 });
    expect((await live.LiveFlight.findByPk(one.id))?.captain_id).toBe(1);
    expect((await live.LiveFlightMember.findByPk(crew.id))?.status).toBe("approved");
    expect(await live.LiveScheduleEvent.count()).toBe(0);
    expect(await live.IfLiveOutbox.count()).toBe(0);
  });

  it("persists a local-start policy and preserves publication history when starting a linked aircraft", async () => {
    const schedule = await flight({ publishing_state: "conflict" });
    await live.LiveAircraft.update({ if_aircraft_id: randomUUID() }, { where: { id: 1 } });
    await expect(service.changeFlight(captain, { action: "start", flight_id: schedule.id })).rejects.toMatchObject({ status: 409 });
    await settings.changeSchedulingSettings(9, { allowUnpublishedIfStarts: true });
    expect((await service.schedulingSnapshot(captain)).configuration.allowUnpublishedIfStarts).toBe(true);
    await service.changeFlight(captain, { action: "start", flight_id: schedule.id });
    expect((await live.LiveFlight.findByPk(schedule.id))?.toJSON()).toMatchObject({ status: "in_progress", publishing_state: "conflict", published_revision: 0 });
    expect((await live.LiveScheduleEvent.findOne({ where: { flight_id: schedule.id, action: "start" } }))?.toJSON()).toMatchObject({ details: { if_publication_bypassed: true } });
  });

  it("rejects a pilot attempting to change the start policy without administrator permission", async () => {
    await expect(settings.changeSchedulingSettings(1, { allowUnpublishedIfStarts: true })).rejects.toMatchObject({ status: 403 });
    expect(await settings.getSchedulingSettings()).toEqual({ allowUnpublishedIfStarts: false });
  });

  it("rechecks a disabling policy committed before a waiting bypass start gets the scheduling mutex", async () => {
    const schedule = await flight({ publishing_state: "queued" });
    await live.LiveAircraft.update({ if_aircraft_id: randomUUID() }, { where: { id: 1 } });
    await settings.changeSchedulingSettings(9, { allowUnpublishedIfStarts: true });
    let locked!: () => void;
    let release!: () => void;
    let firstAttempt!: () => void;
    let secondAttempt!: () => void;
    const lockReady = new Promise<void>(resolve => { locked = resolve; });
    const allowCommit = new Promise<void>(resolve => { release = resolve; });
    const disablingAttempted = new Promise<void>(resolve => { firstAttempt = resolve; });
    const startingAttempted = new Promise<void>(resolve => { secondAttempt = resolve; });
    const blocker = database.transaction(async transaction => {
      await database.query("SELECT name FROM options WHERE name = 'live_scheduling_mutex' FOR UPDATE", { transaction, type: QueryTypes.SELECT });
      locked(); await allowCommit;
    });
    void blocker.catch(() => locked());
    await lockReady;
    const original = database.query.bind(database);
    let lockAttempts = 0;
    const observer = vi.spyOn(database, "query").mockImplementation(((sql: string, options: unknown) => {
      if (typeof sql === "string" && sql.includes("live_scheduling_mutex") && sql.includes("FOR UPDATE")) {
        if (++lockAttempts === 1) firstAttempt(); else secondAttempt();
      }
      return original(sql, options as any);
    }) as typeof database.query);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Policy/start never attempted the held scheduling mutex")), schedulingMutexWaitMs); });
    const disabling = settings.changeSchedulingSettings(9, { allowUnpublishedIfStarts: false });
    void disabling.catch(() => {});
    let starting: ReturnType<typeof service.changeFlight> | undefined;
    try {
      await Promise.race([disablingAttempted, timeout]);
      starting = service.changeFlight(captain, { action: "start", flight_id: schedule.id });
      void starting.catch(() => {});
      await Promise.race([startingAttempted, timeout]);
      release(); await blocker; await disabling;
      await expect(starting).rejects.toMatchObject({ status: 409 });
      expect((await live.LiveFlight.findByPk(schedule.id))?.status).toBe("approved");
      expect(await live.LiveScheduleEvent.count({ where: { flight_id: schedule.id, action: "start" } })).toBe(0);
    } finally {
      if (timer) clearTimeout(timer);
      release(); observer.mockRestore();
      await Promise.allSettled([blocker, disabling, ...(starting ? [starting] : [])]);
    }
  });
});
