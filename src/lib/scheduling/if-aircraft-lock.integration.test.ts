import { isAbsolute } from "node:path";
import { Sequelize, QueryTypes } from "sequelize";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const suppliedUrl = process.env.SCHEDULING_TEST_DATABASE_URL;

function remoteTestTlsAllowed(target: URL) {
  return process.env.SCHEDULING_TEST_ALLOW_REMOTE === "1"
    && target.searchParams.get("sslmode") === "verify-full"
    && isAbsolute(target.searchParams.get("sslrootcert") || "");
}

describe.skipIf(!suppliedUrl)("PostgreSQL aircraft advisory locks with a two-connection pool", () => {
  let database: Sequelize;
  let otherProcess: Sequelize;
  let locks: typeof import("./if-aircraft-lock");
  const aircraftId = 1_700_000_000 + Math.floor(Math.random() * 100_000);

  beforeAll(async () => {
    const target = new URL(suppliedUrl!);
    const loopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(target.hostname);
    if (!["postgres:", "postgresql:"].includes(target.protocol)
      || !/^webncrew_scheduling_test_[a-z0-9_]+$/i.test(decodeURIComponent(target.pathname.slice(1)))
      || (!loopback && !remoteTestTlsAllowed(target))) {
      throw new Error("Aircraft lock tests require webncrew_scheduling_test_<name>; remote access requires SCHEDULING_TEST_ALLOW_REMOTE=1, sslmode=verify-full and an absolute sslrootcert path");
    }
    const acquire = loopback ? 1000 : 10000;
    database = new Sequelize(target.toString(), { dialect: "postgres", logging: false, pool: { min: 0, max: 2, acquire }, dialectOptions: { ...(loopback ? { ssl: false } : {}) } });
    otherProcess = new Sequelize(target.toString(), { dialect: "postgres", logging: false, pool: { min: 0, max: 1, acquire }, dialectOptions: { ...(loopback ? { ssl: false } : {}) } });
    vi.stubEnv("DB_POOL_MAX", "2");
    vi.doMock("@/lib/database", () => ({ default: database }));
    locks = await import("./if-aircraft-lock");
  });

  afterAll(async () => {
    if (database) await database.close();
    if (otherProcess) await otherProcess.close();
    vi.doUnmock("@/lib/database");
    vi.unstubAllEnvs();
  });

  it("reserves a connection for committed checkpoints instead of starving its lock holder", async () => {
    const lease = await locks.acquireIfAircraftLock(aircraftId);
    expect(lease).not.toBeNull();
    try {
      // An additional long-lived lease must not consume the checkpoint slot.
      expect(await locks.acquireIfAircraftLock(aircraftId + 1)).toBeNull();
      await database.transaction(async transaction => {
        expect(await database.query("SELECT 1 AS checkpoint", { transaction, type: QueryTypes.SELECT })).toEqual([{ checkpoint: 1 }]);
      });
    } finally { await lease?.release(); }
    const next = await locks.acquireIfAircraftLock(aircraftId + 1);
    expect(next).not.toBeNull();
    await next?.release();
  });

  it("excludes the same aircraft across processes while allowing another aircraft", async () => {
    const lease = await locks.acquireIfAircraftLock(aircraftId);
    try {
      await otherProcess.transaction(async transaction => {
        const rows = await otherProcess.query<{ same: boolean; other: boolean }>(
          "SELECT pg_try_advisory_xact_lock(:namespace, :same) AS same, pg_try_advisory_xact_lock(:namespace, :other) AS other",
          { replacements: { namespace: locks.IF_AIRCRAFT_LOCK_NAMESPACE, same: aircraftId, other: aircraftId + 1 }, transaction, type: QueryTypes.SELECT },
        );
        expect(rows).toEqual([{ same: false, other: true }]);
      });
      const rows = await otherProcess.query( `SELECT ${locks.ifAircraftLockAvailableSql(":aircraftId")} AS available`,
        { replacements: { aircraftId }, type: QueryTypes.SELECT });
      expect(rows).toEqual([{ available: false }]);
    } finally { await lease?.release(); }
    expect(await otherProcess.query(`SELECT ${locks.ifAircraftLockAvailableSql(":aircraftId")} AS available`,
      { replacements: { aircraftId }, type: QueryTypes.SELECT })).toEqual([{ available: true }]);
  });

  it("releases the database lock after a failed operation and supports repeated cleanup", async () => {
    const lease = await locks.acquireIfAircraftLock(aircraftId);
    await expect((async () => {
      try { throw new Error("Simulated IF failure"); }
      finally { await lease?.release(); }
    })()).rejects.toThrow("Simulated IF failure");
    await lease?.release();
    const next = await locks.acquireIfAircraftLock(aircraftId);
    expect(next).not.toBeNull();
    await next?.release();
  });
});
