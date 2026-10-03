import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Sequelize, QueryTypes } from "sequelize";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Opt in with a NEW, EMPTY database, for example:
// SCHEDULING_TEST_DATABASE_URL=mysql://user:password@127.0.0.1/webncrew_scheduling_test_local npm test -- src/lib/scheduling/service.integration.test.ts
// No production database environment variables are read by this suite.
const suppliedUrl = process.env.SCHEDULING_TEST_DATABASE_URL;
function isolatedTarget(raw: string) {
  const target = new URL(raw);
  const database = decodeURIComponent(target.pathname.slice(1));
  if (target.protocol !== "mysql:" || !/^webncrew_scheduling_test_[a-z0-9_]+$/i.test(database)) {
    throw new Error("Scheduling integration tests require a dedicated mysql:// database named webncrew_scheduling_test_<name>");
  }
  const isLoopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(target.hostname);
  if (!isLoopback && process.env.SCHEDULING_TEST_ALLOW_REMOTE !== "true") {
    throw new Error("Scheduling integration tests require a loopback host; explicitly set SCHEDULING_TEST_ALLOW_REMOTE=true only for a dedicated remote test database");
  }
  return { url: target.toString(), database };
}

describe.skipIf(!suppliedUrl)("MySQL live scheduling transaction concurrency", () => {
  let database: Sequelize;
  let base: typeof import("@/lib/models").models;
  let live: typeof import("./models");
  let service: typeof import("./service");
  let mayCleanUp = false;
  const captain = { id: 1, admin: false };
  const administrator = { id: 9, admin: true };
  const at = (hour: number) => new Date(`2026-10-02T${String(hour).padStart(2, "0")}:00:00Z`);
  const tables = ["if_live_outbox", "live_schedule_events", "live_flight_members", "live_flights", "live_aircraft", "if_live_connections", "awards_granted", "awards", "aircraft", "pilots", "options"];

  beforeAll(async () => {
    const target = isolatedTarget(suppliedUrl!);
    database = new Sequelize(target.url, {
      dialect: "mysql", logging: false, timezone: "+00:00",
      pool: { min: 0, max: 8 }, dialectOptions: { multipleStatements: true },
    });
    await database.authenticate();
    const selected = await database.query<{ name: string }>("SELECT DATABASE() AS name", { type: QueryTypes.SELECT });
    if (selected[0]?.name !== target.database) throw new Error("The test connection selected an unexpected database");
    const existing = await database.query("SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE()", { type: QueryTypes.SELECT });
    if (existing.length) throw new Error("The scheduling test database must be empty. Existing tables will never be modified or deleted.");

    // Redirect the actual Sequelize models/service before importing either.
    vi.doMock("@/lib/database", () => ({ default: database }));
    base = (await import("@/lib/models")).models;
    live = await import("./models");
    service = await import("./service");
    vi.stubEnv("LIVE_PILOT_AWARD_ID", "7");
    vi.stubEnv("IF_LIVE_AUTO_PUBLISH_ENABLED", "false");
    mayCleanUp = true;
    await database.query(`
      CREATE TABLE pilots (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, callsign VARCHAR(120) NOT NULL,
        name TEXT NOT NULL, ifc TEXT NOT NULL, ifuserid VARCHAR(36) NULL,
        email TEXT NOT NULL, password TEXT NOT NULL, transhours INT NOT NULL DEFAULT 0,
        transflights INT NOT NULL DEFAULT 0, notes VARCHAR(1200) NOT NULL DEFAULT '',
        status INT NOT NULL DEFAULT 1, joined DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
      CREATE TABLE aircraft (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, name TEXT NOT NULL,
        ifaircraftid TEXT NULL, liveryname TEXT NULL, ifliveryid TEXT NULL,
        notes VARCHAR(12) NULL, rankreq INT NULL, awardreq INT NULL, status INT NOT NULL DEFAULT 1
      ) ENGINE=InnoDB;
      CREATE TABLE awards (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, name TEXT NOT NULL,
        description TEXT NOT NULL, imageurl TEXT NOT NULL, featured TINYINT NULL
      ) ENGINE=InnoDB;
      CREATE TABLE awards_granted (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, pilotid INT NOT NULL, awardid INT NOT NULL,
        dateawarded DATE NOT NULL, UNIQUE KEY pilot_award (pilotid, awardid),
        FOREIGN KEY (pilotid) REFERENCES pilots(id), FOREIGN KEY (awardid) REFERENCES awards(id)
      ) ENGINE=InnoDB;
    `);
    const migration = await readFile(new URL("../../../migrations/20261002_live_scheduling.sql", import.meta.url), "utf8");
    await database.query(migration);
  }, 30_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    if (database) {
      try {
        if (mayCleanUp) await database.query(`SET FOREIGN_KEY_CHECKS=0; ${tables.map(table => `DROP TABLE IF EXISTS \`${table}\``).join("; ")}; SET FOREIGN_KEY_CHECKS=1;`);
      } finally { await database.close(); }
    }
    vi.doUnmock("@/lib/database");
  }, 30_000);

  beforeEach(async () => {
    for (const table of tables.filter(name => name !== "options")) await database.query(`DELETE FROM \`${table}\``);
    await base.Pilot.bulkCreate([1, 2, 3, 4, 5, 9].map(id => ({
      id, name: `Test Pilot ${id}`, callsign: `TEST${id}`, ifc: `test${id}`,
      email: `pilot${id}@example.com`, password: "unused-test-password", status: 1,
    })));
    await base.Award.create({ id: 7, name: "Live Pilot", description: "Test gate", imageurl: "https://example.com/award.png" });
    await base.AwardGranted.bulkCreate([1, 2, 3, 4, 5].map(pilotid => ({ pilotid, awardid: 7, dateawarded: new Date() })));
    await base.Aircraft.create({ id: 1, name: "Test A350", status: 1 });
    await live.LiveAircraft.bulkCreate([
      { id: 1, registration: "C-TEST1", aircraft_id: 1, current_airport: "CYYZ" },
      { id: 2, registration: "C-TEST2", aircraft_id: 1, current_airport: "CYYZ" },
    ]);
  }, 15_000);

  async function flight(overrides: Record<string, unknown> = {}) {
    return live.LiveFlight.create({
      public_id: randomUUID(), live_aircraft_id: 1, captain_id: 1,
      departure: "CYYZ", arrival: "KJFK", scheduled_departure: at(10), scheduled_arrival: at(12),
      status: "approved", ...overrides,
    });
  }
  function expectOneWinner(results: PromiseSettledResult<unknown>[]) {
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: 409 });
  }

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
});
