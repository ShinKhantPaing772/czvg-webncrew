import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Sequelize, QueryTypes } from "sequelize";
import { createConnection, type Connection, type RowDataPacket } from "mysql2/promise";
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
  let migratedQueue: Array<{ id: number; queue_order: number | null }>;
  const captain = { id: 1, admin: false };
  const administrator = { id: 9, admin: true };
  const at = (hour: number) => new Date(`2026-10-02T${String(hour).padStart(2, "0")}:00:00Z`);
  const tables = ["if_live_outbox", "live_schedule_events", "live_flight_members", "live_flights", "live_aircraft", "if_live_connections", "awards_granted", "awards", "aircraft", "pilots", "options"];
  const migrationTables = ["live_flights_migration_full", "live_flights_migration_repair"];
  const createdMigrationTables = new Set<string>();

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
    // Exercise the upgrade against legacy rows, not just an empty schema.
    await database.query(`
      INSERT INTO pilots (id, callsign, name, ifc, email, password) VALUES (1, 'OLD1', 'Legacy pilot', 'old1', 'old@example.com', 'unused');
      INSERT INTO aircraft (id, name) VALUES (1, 'Legacy aircraft');
      INSERT INTO live_aircraft (id, registration, aircraft_id, current_airport) VALUES (1, 'C-LEGACY1', 1, 'CYYZ'), (2, 'C-LEGACY2', 1, 'CYYZ');
      INSERT INTO live_flights (id, public_id, live_aircraft_id, captain_id, departure, arrival, scheduled_departure, scheduled_arrival, status) VALUES
        (1, '${randomUUID()}', 1, 1, 'KJFK', 'EGLL', '2026-10-02 12:00:00', '2026-10-02 18:00:00', 'approved'),
        (2, '${randomUUID()}', 1, 1, 'CYYZ', 'KJFK', '2026-10-02 10:00:00', '2026-10-02 11:00:00', 'approved'),
        (3, '${randomUUID()}', 1, 1, 'EGLL', 'LFPG', '2026-10-02 20:00:00', '2026-10-02 21:00:00', 'pending'),
        (4, '${randomUUID()}', 1, 1, 'CYYZ', 'KBOS', '2026-10-02 08:00:00', '2026-10-02 09:00:00', 'cancelled'),
        (5, '${randomUUID()}', 2, 1, 'CYYZ', 'KJFK', '2026-10-02 10:00:00', '2026-10-02 11:00:00', 'approved');
    `);
    await database.query(await readFile(new URL("../../../migrations/20261004_optional_live_flight_times.sql", import.meta.url), "utf8"));
    migratedQueue = await database.query<{ id: number; queue_order: number | null }>("SELECT id, queue_order FROM live_flights ORDER BY id", { type: QueryTypes.SELECT });
  }, 30_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    if (database) {
      try {
        if (mayCleanUp) await database.query(`SET FOREIGN_KEY_CHECKS=0; ${[...createdMigrationTables, ...tables].map(table => `DROP TABLE IF EXISTS \`${table}\``).join("; ")}; SET FOREIGN_KEY_CHECKS=1;`);
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
    const aircraftId = Number(overrides.live_aircraft_id ?? 1);
    const last = await live.LiveFlight.findOne({ where: { live_aircraft_id: aircraftId }, order: [["queue_order", "DESC"]] });
    return live.LiveFlight.create({
      public_id: randomUUID(), live_aircraft_id: 1, captain_id: 1,
      departure: "CYYZ", arrival: "KJFK", scheduled_departure: at(10), scheduled_arrival: at(12),
      queue_order: overrides.status === "pending" ? null : Number(last?.queue_order ?? 0) + 1,
      status: "approved", ...overrides,
    });
  }

  async function withLegacyMigrationTable(table: string, work: (connection: Connection, rewrite: (sql: string) => string) => Promise<void>) {
    if (!migrationTables.includes(table)) throw new Error("Only this suite's disposable migration tables can be changed");
    const target = isolatedTarget(suppliedUrl!);
    const url = new URL(target.url);
    // A raw connection keeps session variables and every migration statement on
    // one MySQL session, just as running the SQL file in Workbench does.
    const connection = await createConnection({
      host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password), database: target.database,
      multipleStatements: true,
    });
    let safeUpdates: number | undefined;
    let mayDropTable = false;
    const rewrite = (sql: string) => sql.replaceAll("live_flights", table);
    try {
      const [session] = await connection.query<RowDataPacket[]>("SELECT DATABASE() AS name, @@SESSION.SQL_SAFE_UPDATES AS safeUpdates");
      if (session[0]?.name !== target.database) throw new Error("The migration smoke connection selected an unexpected database");
      safeUpdates = Number(session[0].safeUpdates);
      const [existing] = await connection.query<RowDataPacket[]>("SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?", [table]);
      if (existing.length) throw new Error("The disposable migration fixture table already exists; it will not be changed or deleted");
      const baseMigration = await readFile(new URL("../../../migrations/20261002_live_scheduling.sql", import.meta.url), "utf8");
      const create = baseMigration.match(/CREATE TABLE IF NOT EXISTS `live_flights` \([\s\S]*?\) ENGINE=InnoDB;/)?.[0];
      if (!create) throw new Error("The legacy live_flights CREATE statement was not found");
      await connection.query(rewrite(create));
      mayDropTable = true;
      createdMigrationTables.add(table);
      await connection.query(`
        INSERT INTO \`${table}\` (id, public_id, live_aircraft_id, captain_id, departure, arrival, scheduled_departure, scheduled_arrival, status) VALUES
          (1, '${randomUUID()}', 1, 1, 'KJFK', 'EGLL', '2026-10-02 12:00:00', '2026-10-02 18:00:00', 'approved'),
          (2, '${randomUUID()}', 1, 1, 'CYYZ', 'KJFK', '2026-10-02 10:00:00', '2026-10-02 11:00:00', 'approved'),
          (3, '${randomUUID()}', 1, 1, 'EGLL', 'LFPG', '2026-10-02 20:00:00', '2026-10-02 21:00:00', 'pending'),
          (4, '${randomUUID()}', 1, 1, 'CYYZ', 'KBOS', '2026-10-02 08:00:00', '2026-10-02 09:00:00', 'cancelled'),
          (5, '${randomUUID()}', 2, 1, 'CYYZ', 'KJFK', '2026-10-02 10:00:00', '2026-10-02 11:00:00', 'in_progress');
      `);
      await connection.query("SET SESSION SQL_SAFE_UPDATES = 1");
      await work(connection, rewrite);
    } finally {
      try {
        if (safeUpdates === 0 || safeUpdates === 1) await connection.query(`SET SESSION SQL_SAFE_UPDATES = ${safeUpdates}`);
        if (mayDropTable) { await connection.query(`DROP TABLE IF EXISTS \`${table}\``); createdMigrationTables.delete(table); }
      } finally { await connection.end(); }
    }
  }

  async function verifyMigratedTable(connection: Connection, table: string) {
    const [session] = await connection.query<RowDataPacket[]>("SELECT @@SESSION.SQL_SAFE_UPDATES AS safeUpdates");
    expect(Number(session[0].safeUpdates)).toBe(1);
    const [rows] = await connection.query<RowDataPacket[]>(`SELECT id, queue_order FROM \`${table}\` ORDER BY id`);
    expect(rows.map(row => ({ id: row.id, queue_order: row.queue_order }))).toEqual([
      { id: 1, queue_order: 3 }, { id: 2, queue_order: 2 }, { id: 3, queue_order: null }, { id: 4, queue_order: 1 }, { id: 5, queue_order: 1 },
    ]);
    await expect(connection.query(`UPDATE \`${table}\` SET queue_order = NULL WHERE id = 1`)).rejects.toMatchObject({ errno: 3819 });
    await expect(connection.query(`UPDATE \`${table}\` SET scheduled_arrival = NULL WHERE id = 1`)).rejects.toMatchObject({ errno: 3819 });
    await expect(connection.query(`UPDATE \`${table}\` SET queue_order = -1 WHERE id = 1`)).rejects.toMatchObject({ errno: 3819 });
    await expect(connection.query(`UPDATE \`${table}\` SET queue_order = 2 WHERE id = 1`)).rejects.toMatchObject({ errno: 1062 });
    await connection.query(`INSERT INTO \`${table}\` (public_id, live_aircraft_id, captain_id, departure, arrival, queue_order, scheduled_departure, scheduled_arrival, status)
      VALUES ('${randomUUID()}', 1, 1, 'EGLL', 'LFPG', 4, NULL, NULL, 'approved')`);
  }

  it("applies the complete optional-times SQL file with Workbench safe updates enabled and restores that setting", async () => {
    await withLegacyMigrationTable(migrationTables[0], async (connection, rewrite) => {
      const migration = await readFile(new URL("../../../migrations/20261004_optional_live_flight_times.sql", import.meta.url), "utf8");
      await connection.query(rewrite(migration));
      await verifyMigratedTable(connection, migrationTables[0]);
    });
  });

  it("repairs the exact partial migration left by safe-update 1175 followed by CHECK 3819", async () => {
    await withLegacyMigrationTable(migrationTables[1], async (connection, rewrite) => {
      const migration = await readFile(new URL("../../../migrations/20261004_optional_live_flight_times.sql", import.meta.url), "utf8");
      const alters = migration.match(/ALTER TABLE `live_flights`[\s\S]*?;/g);
      const backfill = migration.match(/UPDATE `live_flights`[\s\S]*?;/)?.[0];
      if (alters?.length !== 2 || !backfill) throw new Error("Expected the optional-times migration's two ALTERs and backfill UPDATE");
      await connection.query(rewrite(alters[0]));
      await expect(connection.query(rewrite(backfill))).rejects.toMatchObject({ errno: 1175 });
      await expect(connection.query(rewrite(alters[1]))).rejects.toMatchObject({ errno: 3819 });
      const [unassigned] = await connection.query<RowDataPacket[]>(`SELECT queue_order FROM \`${migrationTables[1]}\``);
      expect(unassigned.every(row => row.queue_order === null)).toBe(true);
      // MySQL's failed final ALTER is atomic: the old queue index survives and
      // neither the replacement unique index nor any CHECK was installed.
      const [indexes] = await connection.query<RowDataPacket[]>("SELECT INDEX_NAME, COLUMN_NAME FROM information_schema.statistics WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?", [migrationTables[1]]);
      expect(indexes.some(row => row.INDEX_NAME === `${migrationTables[1]}_queue` && row.COLUMN_NAME === "scheduled_departure")).toBe(true);
      expect(indexes.some(row => row.INDEX_NAME === `${migrationTables[1]}_queue_order`)).toBe(false);
      const [checks] = await connection.query<RowDataPacket[]>("SELECT CONSTRAINT_NAME FROM information_schema.table_constraints WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'CHECK'", [migrationTables[1]]);
      expect(checks).toHaveLength(0);
      const repair = await readFile(new URL("../../../migrations/20261004_optional_live_flight_times_repair.sql", import.meta.url), "utf8");
      await connection.query(rewrite(repair));
      await verifyMigratedTable(connection, migrationTables[1]);
    });
  });

  it("backfills legacy flight chronology per aircraft and leaves pending requests unreserved", () => {
    expect(migratedQueue).toEqual([{ id: 1, queue_order: 3 }, { id: 2, queue_order: 2 }, { id: 3, queue_order: null }, { id: 4, queue_order: 1 }, { id: 5, queue_order: 1 }]);
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

  it("allows only one concurrent untimed captain commitment across different aircraft", async () => {
    const one = await flight({ status: "pending", scheduled_departure: null, scheduled_arrival: null });
    const two = await flight({ live_aircraft_id: 2, status: "pending", scheduled_departure: null, scheduled_arrival: null });
    expectOneWinner(await Promise.allSettled([
      service.changeFlight(administrator, { flight_id: one.id, action: "approve" }),
      service.changeFlight(administrator, { flight_id: two.id, action: "approve" }),
    ]));
    expect(await live.LiveFlight.count({ where: { status: "approved" } })).toBe(1);
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
    const lockName = "wnc_if_aircraft_1";
    const lease = await database.transaction();
    try {
      const acquired = await database.query<{ acquired: number }>("SELECT GET_LOCK(:lockName, 0) AS acquired", { replacements: { lockName }, type: QueryTypes.SELECT, transaction: lease });
      expect(acquired[0]?.acquired).toBe(1);
      const proposal = { live_aircraft_id: 1, arrival: "KJFK", scheduled_departure: at(10).toISOString(), scheduled_arrival: at(12).toISOString() };
      await expect(service.requestFlight(captain, proposal)).rejects.toMatchObject({ status: 409 });
      expect(await live.LiveFlight.count()).toBe(0);
      expect(await live.LiveScheduleEvent.count()).toBe(0);
      // The writer's aircraft lock must not block another aircraft's local queue.
      await service.requestFlight(captain, { ...proposal, live_aircraft_id: 2 });
      expect(await live.LiveFlight.count()).toBe(1);
    } finally {
      try { await database.query("SELECT RELEASE_LOCK(:lockName)", { replacements: { lockName }, type: QueryTypes.SELECT, transaction: lease }); }
      finally { await lease.commit(); }
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
});
