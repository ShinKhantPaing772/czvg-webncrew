import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { QueryTypes, Sequelize } from "sequelize";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAwardsSeedSql, MASTER_BADGES } from "../../../scripts/build-all-badges.mjs";
import { setCachedUserPayload } from "../ifc-sync/cache.mjs";
import type { Client } from "pg";

const suppliedUrl = process.env.SCHEDULING_TEST_DATABASE_URL;

function remoteTestTlsAllowed(target: URL) {
  return process.env.SCHEDULING_TEST_ALLOW_REMOTE === "1"
    && target.searchParams.get("sslmode") === "verify-full"
    && path.isAbsolute(target.searchParams.get("sslrootcert") || "");
}
function isolatedTarget(raw: string) {
  const target = new URL(raw);
  const database = decodeURIComponent(target.pathname.slice(1));
  const isLoopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(target.hostname);
  if (!["postgres:", "postgresql:"].includes(target.protocol) ||
      !/^webncrew_scheduling_test_[a-z0-9_]+$/i.test(database)) {
    throw new Error("Award/CLI integration tests require a PostgreSQL database named webncrew_scheduling_test_<name>");
  }
  if (!isLoopback && !remoteTestTlsAllowed(target)) {
    throw new Error("Remote integration tests require SCHEDULING_TEST_ALLOW_REMOTE=1, sslmode=verify-full and an absolute sslrootcert path");
  }
  return { url: target, database, isLoopback };
}

describe.skipIf(!suppliedUrl)("PostgreSQL award runtime and native maintenance commands", () => {
  const schema = `crew_award_runtime_test_${randomUUID().replaceAll("-", "")}`;
  let database: Sequelize;
  let columns: typeof import("./columns");
  let sync: typeof import("./sync");
  let evaluator: typeof import("./evaluator");
  let rankTime: typeof import("../pilot-flight-time");
  let eligibility: typeof import("../aircraft-eligibility");
  let mayCleanUp = false;
  let cliDirectory: string;
  let cliEnvironment: NodeJS.ProcessEnv;
  let cliCommandTimeoutMs = 20_000;
  const repeatedCliTimeoutMs = suppliedUrl && !isolatedTarget(suppliedUrl).isLoopback ? 360_000 : 30_000;
  const child = promisify(execFile);

  beforeAll(async () => {
    const target = isolatedTarget(suppliedUrl!);
    cliCommandTimeoutMs = target.isLoopback ? 20_000 : 120_000;
    database = new Sequelize(target.url.toString(), {
      dialect: "postgres", logging: false, timezone: "+00:00", pool: { min: 0, max: 1 },
      dialectOptions: { options: `-c search_path=${schema},public`, ...(target.isLoopback ? { ssl: false } : {}) },
    });
    const selected = await database.query<{ name: string }>("SELECT current_database() AS name", { type: QueryTypes.SELECT });
    if (selected[0]?.name !== target.database) throw new Error("Unexpected award-test database");
    await database.query(`CREATE SCHEMA "${schema}"`);
    mayCleanUp = true;
    await database.query(await readFile(new URL("../../../migrations/postgresql/001_baseline.sql", import.meta.url), "utf8"));
    vi.doMock("@/lib/database", () => ({ default: database }));
    vi.stubEnv("DISCORD_WEBHOOK", "");
    vi.stubEnv("BADGES_CDN_URL", "local");
    vi.stubEnv("NEXT_PUBLIC_BADGES_CDN_URL", "local");
    columns = await import("./columns");
    sync = await import("./sync");
    evaluator = await import("./evaluator");
    rankTime = await import("../pilot-flight-time");
    eligibility = await import("../aircraft-eligibility");
    cliDirectory = await mkdtemp(path.join(tmpdir(), "crew-postgres-cli-"));
    await writeFile(path.join(cliDirectory, "block-network.mjs"), 'globalThis.fetch = async () => { throw new Error("External HTTP is disabled in PostgreSQL CLI tests"); };\n');
    const rootCertificatePath = target.url.searchParams.get("sslrootcert");
    const remoteCa = !target.isLoopback && rootCertificatePath
      ? await readFile(rootCertificatePath, "utf8") : undefined;
    // Explicit scratch credentials only. The empty cwd contains no .env files.
    cliEnvironment = {
      NODE_ENV: "test", DB_HOST: target.url.hostname, DB_PORT: target.url.port || "5432",
      DB_USER: decodeURIComponent(target.url.username), DB_PASSWORD: decodeURIComponent(target.url.password),
      DB_NAME: target.database, DB_SSL: target.isLoopback ? "false" : "true",
      DB_SSL_REJECT_UNAUTHORIZED: "true", ...(remoteCa ? { DB_SSL_CA: remoteCa } : {}), PGOPTIONS: `-c search_path=${schema},public -c timezone=UTC`,
      BADGES_CDN_URL: "local", NEXT_PUBLIC_BADGES_CDN_URL: "local", IF_API: "unused-test-key",
    };
  }, 30_000);

  afterAll(async () => {
    if (database) {
      try { if (mayCleanUp) await database.query(`DROP SCHEMA "${schema}" CASCADE`); }
      finally { await database.close(); }
    }
    if (cliDirectory) await rm(cliDirectory, { recursive: true, force: true });
    vi.doUnmock("@/lib/database");
    vi.unstubAllEnvs();
  }, 30_000);

  beforeEach(async () => {
    await database.query("TRUNCATE pilots, aircraft, ranks, awards, api_cache RESTART IDENTITY CASCADE");
    await database.query(buildAwardsSeedSql());
    await database.query(`INSERT INTO pilots (id, name, email, callsign, ifc, password, status, transhours, joined)
      VALUES (1, 'Test One', 'one@example.com', 'TEST1', 'pilot1', 'unused', 1, 7200, '2026-11-01'),
             (2, 'Test Two', 'two@example.com', 'TEST2', 'pilot2', 'unused', 1, 0, '2026-11-01');
      INSERT INTO aircraft (id, name, status) VALUES (1, 'Test A350', 1);
      INSERT INTO ranks (id, name, timereq) VALUES (1, 'Unlocked rank', 12000), (2, 'Locked rank', 18000);
      INSERT INTO pireps (departure, arrival, flighttime, pilotid, date, aircraftid, fuelused, multi, status)
      VALUES ('CYYZ', 'CYVR', 3600, 1, '2026-11-01', 1, 1000, '', 1),
             ('CYVR', 'CYYZ', 1800, 1, '2026-11-02', 1, 1000, '', 1),
             ('CYYZ', 'CYVR', 999999, 1, '2026-11-03', 1, 1000, '', 0)`);
  });

  async function runCli(filename: string, args: string[] = []) {
    const script = fileURLToPath(new URL(`../../../scripts/${filename}`, import.meta.url));
    return child(process.execPath, ["--import", path.join(cliDirectory, "block-network.mjs"), script, ...args], {
      cwd: cliDirectory, env: cliEnvironment, timeout: cliCommandTimeoutMs, maxBuffer: 1024 * 1024,
    });
  }

  it("discovers the current schema and executes optional award-column DDL", async () => {
    await database.query("ALTER TABLE awards DROP COLUMN name_zh, DROP COLUMN description_zh, DROP COLUMN category, DROP COLUMN criteria");
    await columns.ensureAwardColumnsExist();
    expect(await columns.getAwardExistingColumnNames()).toEqual(new Set([
      "id", "name", "name_zh", "description", "description_zh", "imageurl", "category", "criteria", "featured",
    ]));
    await database.query(buildAwardsSeedSql());
    expect(await columns.getSafeAwards()).toHaveLength(MASTER_BADGES.length);
    await sync.ensureAwardCatalogSeeded();
  });

  it("executes catalog update and bulk-create queries with full PostgreSQL JSON values", async () => {
    await sync.ensureAwardCatalogSeeded();
    await database.query("DELETE FROM awards WHERE name = 'Clear Horizon'");
    await database.query("UPDATE awards SET description_zh = 'Stale text' WHERE name = 'First Light'");
    const result = await sync.syncAwardsCatalogToDatabase();
    expect(result.createdCount).toBe(1);
    const awards = await columns.getSafeAwards();
    expect(awards.filter(award => award.name === "Clear Horizon")).toHaveLength(1);
    expect(awards.find(award => award.name === "First Light")?.description_zh).not.toBe("Stale text");
    expect(awards.find(award => award.name === "Clear Horizon")?.criteria).toEqual({ type: "flights", threshold: 10 });
  });

  it("uses the base-column fallback without aborting its caller's transaction", async () => {
    await columns.ensureAwardColumnsExist();
    await database.query("ALTER TABLE awards DROP COLUMN name_zh");
    try {
      await database.transaction(async transaction => {
        const awards = await columns.getSafeAwards({ transaction });
        expect(awards).toHaveLength(MASTER_BADGES.length);
        expect(awards.find(award => award.name === "First Light")?.name_zh).toBe("初光");
        await database.query("UPDATE pilots SET name = 'Fallback committed' WHERE id = 1", { transaction });
      });
      expect((await database.query<{ name: string }>("SELECT name FROM pilots WHERE id = 1", { type: QueryTypes.SELECT }))[0].name).toBe("Fallback committed");
    } finally {
      await database.query("ALTER TABLE awards ADD COLUMN IF NOT EXISTS name_zh VARCHAR(255)");
    }
  });

  it("evaluates real joined PIREPs, aggregates rank time, and reads badge progression", async () => {
    await sync.ensureAwardCatalogSeeded();
    expect(await rankTime.getPilotRankTime(1)).toEqual({ approvedSeconds: 5400, transferSeconds: 7200, rankSeconds: 12600 });
    expect(await rankTime.getPilotRankTime(2)).toEqual({ approvedSeconds: 0, transferSeconds: 0, rankSeconds: 0 });
    expect(await eligibility.canPilotUseAircraft(1, { rankreq: 1 })).toBe(true);
    expect(await eligibility.canPilotUseAircraft(1, { rankreq: 2 })).toBe(false);
    const awards = await columns.getSafeAwards();
    const firstLight = awards.find(award => award.name === "First Light")!;
    expect(await eligibility.canPilotUseAircraft(1, { awardreq: firstLight.id })).toBe(false);
    expect((await evaluator.evaluateAndGrantAwards(1)).allAwardIds).toContain(firstLight.id);
    expect(await eligibility.canPilotUseAircraft(1, { awardreq: firstLight.id })).toBe(true);
    expect((await evaluator.evaluateAndGrantAwards(1)).grantedAwards).toEqual([]);
    const overview = await evaluator.getPilotBadgesOverview(1);
    expect(overview.totalAvailable).toBe(MASTER_BADGES.length);
    expect(overview.badges.find(badge => badge.name === "First Light")).toMatchObject({ isUnlocked: true, dateAwarded: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(overview.badges.find(badge => badge.name === "Dawn Flight")?.progress?.current).toBe(2);
  });

  it("executes both native award CLIs repeatedly only against the disposable schema", async () => {
    await database.query("DELETE FROM awards WHERE name = 'Clear Horizon'");
    await database.query("UPDATE awards SET description_zh = 'Stale text' WHERE name = 'First Light'");
    expect((await runCli("sync-and-backfill-awards.mjs")).stdout).toContain("Backfill Complete!");
    const counts = await database.query<{ grants: string; notifications: string }>(`SELECT
      (SELECT COUNT(*) FROM awards_granted) AS grants,
      (SELECT COUNT(*) FROM notifications) AS notifications`, { type: QueryTypes.SELECT });
    expect(Number(counts[0].grants)).toBeGreaterThan(0);
    expect(counts[0].notifications).toBe(counts[0].grants);
    expect((await runCli("sync-and-backfill-awards.mjs")).stdout).toContain("Total Grants Awarded: 0");
    expect((await runCli("backfill-awards.mjs")).stdout).toContain("Total Awards Granted: 0");
    const after = await database.query<{ grants: string; notifications: string }>(`SELECT
      (SELECT COUNT(*) FROM awards_granted) AS grants,
      (SELECT COUNT(*) FROM notifications) AS notifications`, { type: QueryTypes.SELECT });
    expect(after).toEqual(counts);
  }, repeatedCliTimeoutMs);

  it("runs the native IFC command in default audit mode without HTTP or identity writes", async () => {
    const first = "10000000-0000-0000-0000-000000000001";
    const second = "10000000-0000-0000-0000-000000000002";
    await database.query("UPDATE pilots SET ifuserid = CASE id WHEN 1 THEN :first ELSE :second END", { replacements: { first, second } });
    const client = await database.connectionManager.getConnection({ type: "write" }) as Client;
    try {
      await setCachedUserPayload(client, { userIds: [first, second] }, { errorCode: 0, result: [
        { userId: first, discourseUsername: "UpdatedPilotOne", errorCode: 0 },
        { userId: second, discourseUsername: "pilot2", errorCode: 0 },
      ] });
    } finally { database.connectionManager.releaseConnection(client); }
    const result = await runCli("sync-ifc-users.mjs");
    expect(result.stdout).toContain("Dry run only");
    expect(result.stdout).toContain("1 update");
    expect((await database.query<{ ifc: string }>("SELECT ifc FROM pilots WHERE id = 1", { type: QueryTypes.SELECT }))[0].ifc).toBe("pilot1");
  });
});
