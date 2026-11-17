import { isAbsolute } from "node:path";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { QueryTypes, Sequelize } from "sequelize";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyPlans } from "./database.mjs";
import { ensureApiCacheTable, getCachedUserPayload, setCachedUserPayload } from "./cache.mjs";
import { insertAwardGrants } from "../../../scripts/postgres-awards.mjs";
import { buildAwardsSeedSql } from "../../../scripts/build-all-badges.mjs";

const suppliedUrl = process.env.SCHEDULING_TEST_DATABASE_URL;

function remoteTestTlsAllowed(target: URL) {
  return process.env.SCHEDULING_TEST_ALLOW_REMOTE === "1"
    && target.searchParams.get("sslmode") === "verify-full"
    && isAbsolute(target.searchParams.get("sslrootcert") || "");
}
function isolatedTarget(raw: string) {
  const target = new URL(raw);
  const database = decodeURIComponent(target.pathname.slice(1));
  const isLoopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(target.hostname);
  if (!["postgres:", "postgresql:"].includes(target.protocol) ||
      !/^webncrew_scheduling_test_[a-z0-9_]+$/i.test(database)) {
    throw new Error("Cache/script integration tests require a PostgreSQL database named webncrew_scheduling_test_<name>");
  }
  if (!isLoopback && !remoteTestTlsAllowed(target)) {
    throw new Error("Remote integration tests require SCHEDULING_TEST_ALLOW_REMOTE=1, sslmode=verify-full and an absolute sslrootcert path");
  }
  return { url: target.toString(), database, isLoopback };
}

describe.skipIf(!suppliedUrl)("PostgreSQL cache and maintenance scripts", () => {
  let database: Sequelize;
  let cache: typeof import("../utils/if-cache");
  let evaluator: typeof import("../awards/evaluator");
  const evaluationCatalog: { available: any[]; master: any[] } = { available: [], master: [] };
  let mayCleanUp = false;
  const schema = `crew_cache_script_test_${randomUUID().replaceAll("-", "")}`;

  beforeAll(async () => {
    const target = isolatedTarget(suppliedUrl!);
    database = new Sequelize(target.url, {
      dialect: "postgres", logging: false, timezone: "+00:00", pool: { min: 0, max: 2 },
      dialectOptions: { options: `-c search_path=${schema},public`, ...(target.isLoopback ? { ssl: false } : {}) },
    });
    const selected = await database.query<{ name: string }>("SELECT current_database() AS name", { type: QueryTypes.SELECT });
    if (selected[0]?.name !== target.database) throw new Error("Unexpected integration-test database");
    await database.query(`CREATE SCHEMA "${schema}"`);
    mayCleanUp = true;
    await database.query(await readFile(new URL("../../../migrations/postgresql/001_baseline.sql", import.meta.url), "utf8"));
    vi.doMock("@/lib/database", () => ({ default: database }));
    vi.doMock("../awards/columns", () => ({ getSafeAwards: async () => evaluationCatalog.available }));
    vi.doMock("../awards/catalog", () => ({ MASTER_BADGES: evaluationCatalog.master }));
    vi.stubEnv("DISCORD_WEBHOOK", "");
    cache = await import("../utils/if-cache");
    evaluator = await import("../awards/evaluator");
  }, 30_000);

  afterAll(async () => {
    if (database) {
      try { if (mayCleanUp) await database.query(`DROP SCHEMA "${schema}" CASCADE`); }
      finally { await database.close(); }
    }
    vi.doUnmock("@/lib/database");
    vi.doUnmock("../awards/columns");
    vi.doUnmock("../awards/catalog");
    vi.unstubAllEnvs();
  }, 30_000);

  beforeEach(async () => {
    evaluationCatalog.available.length = 0;
    evaluationCatalog.master.length = 0;
    await database.query("TRUNCATE pilots, aircraft, awards, awards_granted, notifications, api_cache RESTART IDENTITY CASCADE");
    await database.query(`INSERT INTO pilots (id, name, email, callsign, ifc, password, status)
      VALUES (1, 'Test One', 'one@example.com', 'TEST1', 'pilot1', 'unused', 1),
             (2, 'Test Two', 'two@example.com', 'TEST2', 'pilot2', 'unused', 1)`);
  });

  async function withClient<T>(work: (client: Client) => Promise<T>) {
    const client = await database.connectionManager.getConnection({ type: "write" }) as Client;
    try { return await work(client); }
    finally { database.connectionManager.releaseConnection(client); }
  }

  it("counts concurrent hits exactly once and resets only expired windows", async () => {
    const counts = await Promise.all(Array.from({ length: 20 }, () => cache.incrementCounter("integration:counter", 600)));
    expect(counts.sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    const original = await database.query<{ expires_at: string }>("SELECT expires_at FROM api_cache WHERE cache_key = 'integration:counter'", { type: QueryTypes.SELECT });
    expect(await cache.incrementCounter("integration:counter", 600)).toBe(21);
    const unchanged = await database.query<{ expires_at: string }>("SELECT expires_at FROM api_cache WHERE cache_key = 'integration:counter'", { type: QueryTypes.SELECT });
    expect(unchanged[0].expires_at).toBe(original[0].expires_at);
    await database.query("UPDATE api_cache SET expires_at = 0 WHERE cache_key = 'integration:counter'");
    expect(await cache.incrementCounter("integration:counter", 600)).toBe(1);
  });

  it("shares PostgreSQL cache rows between the application and native pg script", async () => {
    await withClient(async client => {
      await ensureApiCacheTable(client);
      await setCachedUserPayload(client, { userIds: ["USER"] }, { result: [{ userId: "user" }] });
      expect(await getCachedUserPayload(client, { userIds: ["user"] })).toEqual({ result: [{ userId: "user" }] });
    });
    await cache.setCached("integration:shared", { ok: true }, 60);
    expect(await cache.getCached("integration:shared")).toEqual({ ok: true });
  });

  it("rolls back the complete identity batch on a stale pilot, including null originals", async () => {
    const plans = [1, 2].map(id => ({
      changed: true, conflict: false, targetIfc: `updated${id}`, targetIfUserId: `user${id}`,
      pilot: { id, originalIfc: id === 1 ? "pilot1" : "stale", originalIfUserId: null },
    }));
    await withClient(async client => {
      await expect(applyPlans(client, plans)).rejects.toThrow("Pilot #2 changed");
      const rows = await client.query("SELECT ifc FROM pilots ORDER BY id");
      expect(rows.rows.map(row => row.ifc)).toEqual(["pilot1", "pilot2"]);
      plans[1].pilot.originalIfc = "pilot2";
      expect(await applyPlans(client, plans)).toBe(2);
    });
  });

  it("creates notifications only for new grants and rolls back a notification failure", async () => {
    await database.query("INSERT INTO awards (id, name, description, imageurl) VALUES (1, 'Test Award', 'Test', '/test.svg'), (2, 'Other Award', 'Test', '/other.svg')");
    await withClient(async client => {
      const at = new Date("2026-11-11T12:00:00Z");
      const grants = [[1, 1, at], [2, 1, at]];
      const notifications = [1, 2].map(id => [1, "award", "award_granted", JSON.stringify({ awardId: id }), at]);
      expect(await insertAwardGrants(client, grants, notifications)).toBe(2);
      expect(await insertAwardGrants(client, grants, notifications)).toBe(0);
      expect(Number((await client.query("SELECT COUNT(*) FROM notifications")).rows[0].count)).toBe(2);
      await expect(insertAwardGrants(client, [[1, 2, at]], [[2, "award", "x".repeat(21), '{"awardId":1}', at]])).rejects.toMatchObject({ code: "22001" });
      expect(Number((await client.query("SELECT COUNT(*) FROM awards_granted WHERE pilotid = 2")).rows[0].count)).toBe(0);
    });
  });

  it("seeds the catalog repeatedly while preserving an existing award identity", async () => {
    await database.query("INSERT INTO awards (id, name, description, imageurl) VALUES (500, 'First Light', 'Old text', '/old.svg')");
    await withClient(async client => {
      await client.query(buildAwardsSeedSql());
      const before = await client.query("SELECT id, name FROM awards ORDER BY id");
      await client.query(buildAwardsSeedSql());
      expect((await client.query("SELECT id, name FROM awards ORDER BY id")).rows).toEqual(before.rows);
      expect((await client.query("SELECT id FROM awards WHERE name = 'First Light'")).rows).toEqual([{ id: 500 }]);
    });
  });

  async function pendingPirep() {
    await database.query("INSERT INTO aircraft (id, name, status) VALUES (1, 'Test Aircraft', 1)");
    await database.query(`INSERT INTO pireps (id, departure, arrival, flighttime, pilotid, date, aircraftid, fuelused, multi, status)
      VALUES (1, 'CYYZ', 'CYVR', 3600, 1, '2026-11-11', 1, 1000, '', 0)`);
  }

  it("commits a PIREP approval and its award when the optional notification insert fails", async () => {
    await pendingPirep();
    await database.query("INSERT INTO awards (id, name, description, imageurl) VALUES (1, 'First Test Flight', 'Test', '/test.svg')");
    evaluationCatalog.available.push({ id: 1, name: "First Test Flight", criteria: { type: "flights", threshold: 1 } });
    await database.query("ALTER TABLE notifications ADD CONSTRAINT integration_reject_notice CHECK (subject <> 'award_granted')");
    try {
      await database.transaction(async transaction => {
        await database.query("UPDATE pireps SET status = 1 WHERE id = 1", { transaction });
        expect((await evaluator.evaluateAndGrantAwards(1, { transaction })).allAwardIds).toContain(1);
        await database.query("SELECT 1", { transaction });
      });
      expect((await database.query<{ status: number }>("SELECT status FROM pireps WHERE id = 1", { type: QueryTypes.SELECT }))[0].status).toBe(1);
      expect((await database.query("SELECT id FROM awards_granted", { type: QueryTypes.SELECT }))).toHaveLength(1);
      expect((await database.query("SELECT id FROM notifications", { type: QueryTypes.SELECT }))).toHaveLength(0);
    } finally {
      await database.query("ALTER TABLE notifications DROP CONSTRAINT integration_reject_notice");
    }
  });

  it("keeps the approval transaction usable after an optional catalog insert fails", async () => {
    await pendingPirep();
    await database.query("INSERT INTO awards (id, name, description, imageurl) VALUES (101, 'Existing fallback award', 'Test', '/test.svg')");
    evaluationCatalog.master.push({ id: 101, name: "Missing test catalog record", description: "Test", imageurl: "/test.svg", criteria: { type: "flights", threshold: 1 } });
    await database.query("ALTER TABLE awards ADD CONSTRAINT integration_reject_catalog CHECK (name <> 'Missing test catalog record')");
    try {
      await database.transaction(async transaction => {
        await database.query("UPDATE pireps SET status = 1 WHERE id = 1", { transaction });
        expect((await evaluator.evaluateAndGrantAwards(1, { transaction })).allAwardIds).toContain(101);
        await database.query("SELECT 1", { transaction });
      });
      expect((await database.query<{ status: number }>("SELECT status FROM pireps WHERE id = 1", { type: QueryTypes.SELECT }))[0].status).toBe(1);
      expect((await database.query("SELECT id FROM awards_granted", { type: QueryTypes.SELECT }))).toHaveLength(1);
    } finally {
      await database.query("ALTER TABLE awards DROP CONSTRAINT integration_reject_catalog");
    }
  });
});
