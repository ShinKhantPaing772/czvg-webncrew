import { isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Sequelize } from "sequelize";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { IfLiveError } from "./config";
import type { IfCrew, IfSchedule, IfScheduleRequest } from "./types";

const suppliedUrl = process.env.SCHEDULING_TEST_DATABASE_URL;

function remoteTestTlsAllowed(target: URL) {
  return process.env.SCHEDULING_TEST_ALLOW_REMOTE === "1"
    && target.searchParams.get("sslmode") === "verify-full"
    && isAbsolute(target.searchParams.get("sslrootcert") || "");
}
const remote = vi.hoisted(() => ({
  authorization: vi.fn(), binding: vi.fn(), fleet: vi.fn(), schedules: vi.fn(),
  create: vi.fn(), update: vi.fn(), remove: vi.fn(), putCrew: vi.fn(), removeCrew: vi.fn(), reorder: vi.fn(),
}));
vi.mock("./connection", () => ({ getIfAuthorizationSnapshot: remote.authorization }));
vi.mock("./binding", () => ({ validateIfAircraftBinding: remote.binding }));
vi.mock("./client", () => ({
  getIfFleet: remote.fleet, getIfSchedules: remote.schedules, createIfSchedule: remote.create,
  updateIfSchedule: remote.update, deleteIfSchedule: remote.remove, putIfCrew: remote.putCrew,
  removeIfCrew: remote.removeCrew, reorderIfSchedule: remote.reorder,
}));

describe.skipIf(!suppliedUrl)("PostgreSQL publisher transactions and checkpoints", () => {
  let database: Sequelize;
  let administrator: Sequelize;
  let base: typeof import("@/lib/models").models;
  let live: typeof import("../models");
  let publisher: typeof import("./publisher");
  let schedules: IfSchedule[];
  let mayCleanUp = false;
  const schema = `publisher_test_${randomUUID().replaceAll("-", "")}`;
  const organizationId = "10000000-0000-0000-0000-000000000001";
  const aircraftId = "20000000-0000-0000-0000-000000000002";
  const pilotId = "30000000-0000-0000-0000-000000000003";
  const scheduleId = "40000000-0000-0000-0000-000000000004";

  beforeAll(async () => {
    const target = new URL(suppliedUrl!);
    const loopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(target.hostname);
    if (!["postgres:", "postgresql:"].includes(target.protocol)
      || !/^webncrew_scheduling_test_[a-z0-9_]+$/i.test(decodeURIComponent(target.pathname.slice(1)))
      || (!loopback && !remoteTestTlsAllowed(target))) {
      throw new Error("Publisher integration tests require webncrew_scheduling_test_*; remote access requires SCHEDULING_TEST_ALLOW_REMOTE=1, sslmode=verify-full and an absolute sslrootcert path");
    }
    administrator = new Sequelize(target.toString(), { dialect: "postgres", logging: false, pool: { min: 0, max: 1 }, dialectOptions: { ...(loopback ? { ssl: false } : {}) } });
    await administrator.query(`CREATE SCHEMA "${schema}"`);
    mayCleanUp = true;
    database = new Sequelize(target.toString(), {
      dialect: "postgres", logging: false, timezone: "+00:00", pool: { min: 0, max: 3, acquire: loopback ? 2000 : 10000 },
      dialectOptions: { options: `-c search_path=${schema},public -c timezone=UTC`, ...(loopback ? { ssl: false } : {}) },
    });
    await database.query(await readFile(new URL("../../../../migrations/postgresql/001_baseline.sql", import.meta.url), "utf8"));
    vi.doMock("@/lib/database", () => ({ default: database }));
    base = (await import("@/lib/models")).models;
    live = await import("../models");
    publisher = await import("./publisher");
    vi.stubEnv("DB_POOL_MAX", "3");
    vi.stubEnv("LIVE_PILOT_AWARD_ID", "7");
    vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "true");
    vi.stubEnv("IF_LIVE_AUTO_PUBLISH_ENABLED", "true");
    vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "true");
    vi.stubEnv("IF_LIVE_CLIENT_ID", "fixture-client");
    vi.stubEnv("IF_LIVE_CLIENT_SECRET", "fixture-secret");
    vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://example.com/oauth/callback");
    vi.stubEnv("IF_LIVE_REVOCATION_URL", "");
    vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  });

  afterAll(async () => {
    if (database) await database.close();
    if (administrator) {
      try { if (mayCleanUp) await administrator.query(`DROP SCHEMA "${schema}" CASCADE`); }
      finally { await administrator.close(); }
    }
    vi.doUnmock("@/lib/database");
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    schedules = [];
    await database.query("TRUNCATE pilots, awards, aircraft, live_aircraft RESTART IDENTITY CASCADE");
    await base.Pilot.bulkCreate([1, 9].map(id => ({ id, callsign: `TEST${id}`, name: `Pilot ${id}`, ifc: `pilot${id}`, ifuserid: pilotId, email: `pilot${id}@example.com`, password: "unused", status: 1 })));
    await base.Award.create({ id: 7, name: "Live Pilot", description: "Test", imageurl: "/test.svg" });
    await base.AwardGranted.create({ awardid: 7, pilotid: 1, dateawarded: "2026-11-11" });
    await base.Permission.create({ userid: 9, name: "scheduling" });
    await base.Aircraft.create({ id: 1, name: "Test A350", ifaircraftid: aircraftId, status: 1 });
    await live.LiveAircraft.create({ id: 1, registration: "C-PUBLISH", aircraft_id: 1, current_airport: "CYYZ", if_aircraft_id: aircraftId });
    await live.IfLiveConnection.create({ id: 1, connected_by: 9, organization_id: organizationId, access_token_encrypted: "fixture-credential", state: "connected" });
    await live.LiveFlight.create({ id: 1, public_id: randomUUID(), live_aircraft_id: 1, captain_id: 1, departure: "CYYZ", arrival: "CYVR", queue_order: 1, status: "approved", revision: 2, publishing_state: "queued" });
    await live.IfLiveOutbox.create({ flight_id: 1, revision: 2, state: "queued" });
    remote.authorization.mockResolvedValue({ token: "fixture-token", credential: "fixture-credential", owner: 9, organizationId });
    remote.binding.mockResolvedValue({ id: aircraftId });
    remote.fleet.mockResolvedValue([{ id: aircraftId, organizationId, isFleetActiveSlot: true }]);
    remote.schedules.mockImplementation(async () => structuredClone(schedules));
    remote.create.mockImplementation(async (_token, _aircraft, body: IfScheduleRequest) => {
      const row: IfSchedule = { ...body, id: scheduleId, aircraftId, organizationId, status: 1, sequence: 1, crew: [] };
      schedules.push(row);
      return structuredClone(row);
    });
    remote.putCrew.mockImplementation(async (_token, _aircraft, _schedule, crew: IfCrew) => {
      schedules[0].crew.push(crew);
      return structuredClone(schedules[0]);
    });
    remote.remove.mockImplementation(async () => { schedules = []; });
  });

  it("commits real checkpoints, crew publication, outbox completion and the audit event", async () => {
    expect(await publisher.runIfLivePublisher({ flightId: 1 })).toMatchObject({ processed: 1, published: 1, flight: { state: "published", publishedRevision: 2 } });
    expect((await live.LiveFlight.findByPk(1))?.toJSON()).toMatchObject({ if_schedule_id: scheduleId, published_revision: 2, publishing_state: "published", last_published_payload: { crew: [{ userId: pilotId, role: 0 }] } });
    expect((await live.IfLiveOutbox.findOne({ where: { flight_id: 1 } }))?.state).toBe("done");
    expect(await live.LiveScheduleEvent.count({ where: { action: "if_published" } })).toBe(1);
    expect(remote.create).toHaveBeenCalledOnce();
    expect(remote.putCrew).toHaveBeenCalledOnce();
  });

  it("reconciles an uncertain write and retries without sending a duplicate create", async () => {
    remote.create.mockRejectedValueOnce(new IfLiveError("Unconfirmed write", "unavailable", 502, 60, true));
    expect(await publisher.runIfLivePublisher({ flightId: 1 })).toMatchObject({ states: { reconciliation: 1 } });
    await publisher.retryIfPublish(1, "retry", 9);
    expect(await publisher.runIfLivePublisher({ flightId: 1 })).toMatchObject({ states: { reconciliation: 1 } });
    expect(remote.create).toHaveBeenCalledOnce();
    expect((await live.IfLiveOutbox.findOne({ where: { flight_id: 1 } }))?.state).toBe("reconciliation");
  });

  it("removes a cancelled reservation and commits its cleanup through the same SQL path", async () => {
    await publisher.runIfLivePublisher({ flightId: 1 });
    await live.LiveFlight.update({ status: "cancelled", revision: 3, publishing_state: "queued" }, { where: { id: 1 } });
    await live.IfLiveOutbox.create({ flight_id: 1, revision: 3, state: "queued" });
    expect(await publisher.runIfLivePublisher({ aircraftId: 1 })).toMatchObject({ processed: 1, published: 1 });
    expect((await live.LiveFlight.findByPk(1))?.toJSON()).toMatchObject({ if_schedule_id: null, published_revision: 3, publishing_state: "published" });
    expect(await live.IfLiveOutbox.count({ where: { state: "done" } })).toBe(2);
    expect(remote.remove).toHaveBeenCalledOnce();
  });
});
