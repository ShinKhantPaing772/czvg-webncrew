import { readFile } from "node:fs/promises";
import { Sequelize, QueryTypes } from "sequelize";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { IfLiveError } from "./config";
import { ifScheduleFingerprint } from "./schedule-view";
import { buildIfPayload } from "./sync";
import type { IfSchedule, IfScheduleRequest } from "./types";

// Opt in with a NEW, EMPTY disposable database. Run serially with other SQL
// suites; this file never reads the production DB_* environment variables.
const suppliedUrl = process.env.SCHEDULING_TEST_DATABASE_URL;
function isolatedTarget(raw: string) {
  const target = new URL(raw);
  const database = decodeURIComponent(target.pathname.slice(1));
  if (target.protocol !== "mysql:" || !/^webncrew_scheduling_test_[a-z0-9_]+$/i.test(database)) {
    throw new Error("IF matching SQL tests require a dedicated mysql:// database named webncrew_scheduling_test_<name>");
  }
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(target.hostname) && process.env.SCHEDULING_TEST_ALLOW_REMOTE !== "true") {
    throw new Error("IF matching SQL tests require loopback; SCHEDULING_TEST_ALLOW_REMOTE=true is only for an explicitly dedicated remote test database");
  }
  return { url: target.toString(), database };
}

describe.skipIf(!suppliedUrl)("MySQL explicit IF schedule matching", () => {
  let database: Sequelize;
  let base: typeof import("@/lib/models").models;
  let live: typeof import("../models");
  let matching: typeof import("./schedule-match");
  let service: typeof import("../service");
  let settings: typeof import("../settings");
  let mayCleanUp = false;
  let local: InstanceType<typeof import("../models").LiveFlight>;
  const http = { authorization: vi.fn(), binding: vi.fn(), schedules: vi.fn(), update: vi.fn() };
  const tables = ["if_live_outbox", "live_schedule_events", "live_flight_members", "live_flights", "live_aircraft", "if_live_connections", "awards_granted", "awards", "aircraft", "permissions", "pilots", "options"];
  const ORG = "10000000-0000-0000-0000-000000000001";
  const AIRCRAFT = "10000000-0000-0000-0000-000000000002";
  const SELECTED = "10000000-0000-0000-0000-000000000003";
  const CAPTAIN = "10000000-0000-0000-0000-000000000004";
  const CREW = "10000000-0000-0000-0000-000000000005";
  const PUBLIC = "10000000-0000-0000-0000-000000000006";
  const OTHER = "10000000-0000-0000-0000-000000000007";
  const remote: IfSchedule = {
    id: SELECTED, aircraftId: AIRCRAFT, organizationId: ORG, callsign: "IF1", flightType: 1,
    originIcao: "CYYZ", destinationIcao: "CYVR", scheduledDepartureUtc: "2026-10-06T10:00:00Z", scheduledArrivalUtc: "2026-10-06T15:00:00Z",
    briefing: "Fetched private IF briefing", flightPlan: "Fetched private IF flight plan", status: 1, crew: [{ userId: CAPTAIN, role: 0 }], sequence: 1,
  };
  const input = () => ({ flightId: local.id, scheduleId: SELECTED, expectedFingerprint: ifScheduleFingerprint(remote), expectedRevision: 4 });
  const updatedResponse = (body: IfScheduleRequest): IfSchedule => ({ ...remote, ...body, scheduledDepartureUtc: body.scheduledDepartureUtc, scheduledArrivalUtc: body.scheduledArrivalUtc });

  beforeAll(async () => {
    const target = isolatedTarget(suppliedUrl!);
    database = new Sequelize(target.url, { dialect: "mysql", logging: false, timezone: "+00:00", pool: { min: 0, max: 8 }, dialectOptions: { multipleStatements: true } });
    await database.authenticate();
    const selected = await database.query<{ name: string }>("SELECT DATABASE() AS name", { type: QueryTypes.SELECT });
    if (selected[0]?.name !== target.database) throw new Error("The matching test connection selected an unexpected database");
    const existing = await database.query("SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE()", { type: QueryTypes.SELECT });
    if (existing.length) throw new Error("The matching test database must be empty. Existing tables will never be modified or deleted.");

    vi.doMock("@/lib/database", () => ({ default: database }));
    vi.doMock("./connection", () => ({ getIfAuthorizationSnapshot: http.authorization }));
    vi.doMock("./binding", () => ({ validateIfAircraftBinding: http.binding }));
    vi.doMock("./client", () => ({ getIfSchedules: http.schedules, updateIfSchedule: http.update, getIfPosition: vi.fn(), getIfAirport: vi.fn() }));
    base = (await import("@/lib/models")).models;
    live = await import("../models");
    matching = await import("./schedule-match");
    service = await import("../service");
    settings = await import("../settings");
    vi.stubEnv("LIVE_PILOT_AWARD_ID", "7");
    vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "true"); vi.stubEnv("IF_LIVE_AUTO_PUBLISH_ENABLED", "false");
    vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "true"); vi.stubEnv("IF_LIVE_CLIENT_ID", "fixture-client");
    vi.stubEnv("IF_LIVE_CLIENT_SECRET", "fixture-client-secret"); vi.stubEnv("IF_LIVE_REVOCATION_URL", "");
    vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://example.com/oauth/callback");
    vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    mayCleanUp = true;
    await database.query(`
      CREATE TABLE pilots (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, callsign VARCHAR(120) NOT NULL, name TEXT NOT NULL,
        ifc TEXT NOT NULL, ifuserid VARCHAR(36) NULL, email TEXT NOT NULL, password TEXT NOT NULL,
        transhours INT NOT NULL DEFAULT 0, transflights INT NOT NULL DEFAULT 0, notes VARCHAR(1200) NOT NULL DEFAULT '',
        status INT NOT NULL DEFAULT 1, joined DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
      CREATE TABLE aircraft (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, name TEXT NOT NULL, ifaircraftid TEXT NULL,
        liveryname TEXT NULL, ifliveryid TEXT NULL, notes VARCHAR(12) NULL, rankreq INT NULL, awardreq INT NULL,
        status INT NOT NULL DEFAULT 1
      ) ENGINE=InnoDB;
      CREATE TABLE awards (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
        imageurl TEXT NOT NULL, featured TINYINT NULL
      ) ENGINE=InnoDB;
      CREATE TABLE awards_granted (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, pilotid INT NOT NULL, awardid INT NOT NULL,
        dateawarded DATE NOT NULL, UNIQUE KEY pilot_award (pilotid, awardid),
        FOREIGN KEY (pilotid) REFERENCES pilots(id), FOREIGN KEY (awardid) REFERENCES awards(id)
      ) ENGINE=InnoDB;
      CREATE TABLE permissions (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, userid INT NOT NULL,
        FOREIGN KEY (userid) REFERENCES pilots(id)
      ) ENGINE=InnoDB;
    `);
    for (const migration of ["20261002_live_scheduling.sql", "20261004_optional_live_flight_times.sql", "20261004_live_flight_types.sql"]) {
      await database.query(await readFile(new URL(`../../../../migrations/${migration}`, import.meta.url), "utf8"));
    }
  }, 30_000);

  afterAll(async () => {
    vi.restoreAllMocks(); vi.unstubAllEnvs();
    if (database) {
      try {
        if (mayCleanUp) await database.query(`SET FOREIGN_KEY_CHECKS=0; ${tables.map(table => `DROP TABLE IF EXISTS \`${table}\``).join("; ")}; SET FOREIGN_KEY_CHECKS=1;`);
      } finally { await database.close(); }
    }
    for (const path of ["@/lib/database", "./connection", "./binding", "./client"]) vi.doUnmock(path);
  }, 30_000);

  beforeEach(async () => {
    for (const table of tables.filter(name => name !== "options")) await database.query(`DELETE FROM \`${table}\``);
    await database.query("DELETE FROM options WHERE name = :name", { replacements: { name: "live_scheduling_allow_unpublished_if_starts" } });
    await base.Pilot.bulkCreate([1, 2, 9].map(id => ({
      id, name: `Fixture Pilot ${id}`, callsign: `CC${id}`, ifc: `fixture${id}`, ifuserid: id === 1 ? CAPTAIN : id === 2 ? CREW : OTHER,
      email: `fixture${id}@example.com`, password: "unused-fixture-password", status: 1,
    })));
    await base.Permission.create({ userid: 9, name: "scheduling" });
    await base.Award.create({ id: 7, name: "Live Pilot", description: "Fixture gate", imageurl: "https://example.com/live.png" });
    await base.AwardGranted.bulkCreate([1, 2].map(pilotid => ({ pilotid, awardid: 7, dateawarded: new Date() })));
    await base.Aircraft.create({ id: 1, name: "Fixture A350", ifaircraftid: AIRCRAFT, status: 1 });
    await live.LiveAircraft.create({ id: 1, registration: "C-MATCH", aircraft_id: 1, current_airport: "CYYZ", if_aircraft_id: AIRCRAFT });
    await live.IfLiveConnection.create({ id: 1, connected_by: 9, organization_id: ORG, state: "connected", access_token_encrypted: "fixture-encrypted" });
    local = await live.LiveFlight.create({
      id: 1, public_id: PUBLIC, live_aircraft_id: 1, captain_id: 1, callsign: "CC1", departure: "CYYZ", arrival: "CYVR",
      scheduled_departure: null, scheduled_arrival: null, queue_order: 1, status: "approved", revision: 4, publishing_state: "conflict", notes: "Crew Center authored notes",
    });
    await live.LiveFlightMember.create({ flight_id: 1, pilot_id: 2, status: "approved" });
    // Exercise reuse of the current outbox row plus cleanup of an older attempt.
    await live.IfLiveOutbox.bulkCreate([{ flight_id: 1, revision: 3, state: "failed" }, { flight_id: 1, revision: 4, state: "conflict" }]);
    http.authorization.mockReset().mockResolvedValue({ token: "fixture-token", credential: "fixture-encrypted", owner: 9, organizationId: ORG });
    http.binding.mockReset().mockResolvedValue({ id: AIRCRAFT });
    http.schedules.mockReset().mockResolvedValue([structuredClone(remote)]);
    http.update.mockReset().mockImplementation(async (_token, _aircraft, _schedule, body) => updatedResponse(body));
  }, 15_000);

  it("atomically adopts only the reviewed IF ID and queues authored crew synchronization", async () => {
    http.update.mockImplementation(async (_token, _aircraft, _schedule, body) => {
      expect((await live.LiveFlight.findByPk(1))?.toJSON()).toMatchObject({ if_schedule_id: SELECTED, publishing_state: "reconciliation" });
      expect((await live.IfLiveOutbox.findOne({ where: { flight_id: 1, revision: 4 } }))?.state).toBe("reconciliation");
      return updatedResponse(body);
    });
    await expect(matching.matchIfAircraftSchedule(9, input())).resolves.toEqual({ flightId: 1 });
    const desired = buildIfPayload(local, [{ userId: CAPTAIN, role: 0 }, { userId: CREW, role: 1 }]);
    const saved = await live.LiveFlight.findByPk(1);
    expect(saved?.toJSON()).toMatchObject({ if_schedule_id: SELECTED, publishing_state: "queued", published_revision: 0, last_published_payload: { ...desired, crewPending: true } });
    expect(http.update).toHaveBeenCalledOnce(); expect(http.update).toHaveBeenCalledWith("fixture-token", AIRCRAFT, SELECTED, desired.schedule);
    expect(await live.IfLiveOutbox.count({ where: { flight_id: 1, revision: 4 } })).toBe(1);
    expect((await live.IfLiveOutbox.findOne({ where: { flight_id: 1, revision: 4 } }))?.toJSON()).toMatchObject({ state: "queued", action: "sync", lease_until: null });
    expect((await live.IfLiveOutbox.findOne({ where: { flight_id: 1, revision: 3 } }))?.state).toBe("done");
    expect(await live.LiveScheduleEvent.count({ where: { flight_id: 1, action: "if_schedule_matched" } })).toBe(1);
    expect(JSON.stringify(saved?.last_published_payload)).not.toMatch(/Fetched private|organizationId|aircraftId|sequence/);
  });

  it("preserves the selected ID and reconciliation outbox after an uncertain PUT without duplicating a reservation", async () => {
    http.update.mockRejectedValue(new IfLiveError("IF write confirmation timed out", "timeout", 503, 60, true));
    await expect(matching.matchIfAircraftSchedule(9, input())).rejects.toMatchObject({ code: "reconciliation", uncertainWrite: true });
    expect((await live.LiveFlight.findByPk(1))?.toJSON()).toMatchObject({ if_schedule_id: SELECTED, publishing_state: "reconciliation", published_revision: 0, last_published_payload: { crewPending: true } });
    expect((await live.IfLiveOutbox.findOne({ where: { flight_id: 1, revision: 4 } }))?.toJSON()).toMatchObject({ state: "reconciliation", action: "sync" });
    expect(await live.IfLiveOutbox.count({ where: { flight_id: 1, revision: 4 } })).toBe(1);
    expect(await live.LiveScheduleEvent.count({ where: { flight_id: 1, action: "if_schedule_match_requested" } })).toBe(1);
    expect(await live.LiveScheduleEvent.count({ where: { flight_id: 1, action: "if_schedule_matched" } })).toBe(0);
    expect(http.update).toHaveBeenCalledOnce();
    const lock = await database.query<{ available: number }>("SELECT IS_FREE_LOCK(:name) AS available", { replacements: { name: "wnc_if_aircraft_1" }, type: QueryTypes.SELECT });
    expect(Number(lock[0]?.available)).toBe(1);
  });

  it("holds the real aircraft advisory lock against competing matches and local starts throughout an IF write", async () => {
    await settings.changeSchedulingSettings(9, { allowUnpublishedIfStarts: true });
    let writing!: () => void;
    let finishWrite!: () => void;
    const writeStarted = new Promise<void>(resolve => { writing = resolve; });
    const allowResponse = new Promise<void>(resolve => { finishWrite = resolve; });
    http.update.mockImplementation(async (_token, _aircraft, _schedule, body) => { writing(); await allowResponse; return updatedResponse(body); });
    const first = matching.matchIfAircraftSchedule(9, input());
    void first.catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([writeStarted, new Promise<void>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("The match never reached its checkpointed IF write")), 3_000); })]);
      await expect(matching.matchIfAircraftSchedule(9, input())).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("publishing or being edited") });
      await expect(service.changeFlight({ id: 1, admin: false }, { flight_id: 1, action: "start" })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("currently being updated") });
      expect((await live.LiveFlight.findByPk(1))?.status).toBe("approved");
      expect(await live.LiveScheduleEvent.count({ where: { flight_id: 1, action: "start" } })).toBe(0);
      expect(http.update).toHaveBeenCalledOnce();
      finishWrite(); await first;
      expect((await live.LiveFlight.findByPk(1))?.publishing_state).toBe("queued");
    } finally {
      if (timer) clearTimeout(timer);
      finishWrite(); await Promise.allSettled([first]);
    }
  });

  it("refuses an IF ID already owned by another local flight without changing either flight or the outbox", async () => {
    await live.LiveFlight.create({ id: 2, public_id: OTHER, live_aircraft_id: 1, captain_id: 1, departure: "CYYZ", arrival: "CYVR",
      scheduled_departure: null, scheduled_arrival: null, status: "cancelled", if_schedule_id: SELECTED, queue_order: 2 });
    await expect(matching.matchIfAircraftSchedule(9, input())).rejects.toMatchObject({ code: "conflict", message: expect.stringContaining("already owns") });
    expect((await live.LiveFlight.findByPk(1))?.toJSON()).toMatchObject({ if_schedule_id: null, publishing_state: "conflict", last_published_payload: null });
    expect((await live.LiveFlight.findByPk(2))?.if_schedule_id).toBe(SELECTED);
    expect((await live.IfLiveOutbox.findOne({ where: { flight_id: 1, revision: 4 } }))?.state).toBe("conflict");
    expect(await live.LiveScheduleEvent.count()).toBe(0); expect(http.update).not.toHaveBeenCalled();
  });
});
