import { QueryTypes, type Transaction } from "sequelize";
import sequelize from "@/lib/database";
import { databasePoolMax } from "@/lib/database-config.mjs";

// A separate two-integer advisory-lock namespace avoids collisions with other
// application locks. All publishing, editing, matching and local mutations use it.
export const IF_AIRCRAFT_LOCK_NAMESPACE = 0x574e43;
const leaseStateKey = Symbol.for("webncrew.if-aircraft-lock-leases");
// Route bundles sharing a connection pool must also share its lease budget.
const sharedPool = sequelize as typeof sequelize & {
  [leaseStateKey]?: { count: number };
};
const leases = sharedPool[leaseStateKey] ??= { count: 0 };

export async function tryIfAircraftTransactionLock(aircraftId: number, transaction: Transaction) {
  const rows = await sequelize.query<{ acquired: boolean }>(
    "SELECT pg_try_advisory_xact_lock(:namespace, :aircraftId) AS acquired",
    { replacements: { namespace: IF_AIRCRAFT_LOCK_NAMESPACE, aircraftId }, type: QueryTypes.SELECT, transaction },
  );
  return rows[0]?.acquired === true;
}

/** Observation only: never acquire locks while scanning candidate aircraft. */
export function ifAircraftLockAvailableSql(aircraftIdExpression: string) {
  return `NOT EXISTS (SELECT 1 FROM pg_locks AS aircraft_lock
    WHERE aircraft_lock.locktype = 'advisory' AND aircraft_lock.granted
      AND aircraft_lock.database = (SELECT oid FROM pg_database WHERE datname = current_database())
      AND aircraft_lock.classid = ${IF_AIRCRAFT_LOCK_NAMESPACE}
      AND aircraft_lock.objid = ${aircraftIdExpression} AND aircraft_lock.objsubid = 2)`;
}

/**
 * Keep an advisory transaction on its own connection across IF HTTP calls.
 * Short checkpoint transactions still commit independently. Reserve a pool
 * slot for that work so concurrent lock holders cannot starve one another.
 * No aircraft, pilot, OAuth or mutex row locks are held on this connection.
 */
export async function acquireIfAircraftLock(aircraftId: number) {
  const maximum = databasePoolMax();
  if (leases.count >= maximum - 1) return null;
  leases.count += 1;
  let transaction: Transaction | undefined;
  try {
    transaction = await sequelize.transaction();
    if (!await tryIfAircraftTransactionLock(aircraftId, transaction)) {
      await transaction.commit();
      leases.count -= 1;
      return null;
    }
    const held = transaction;
    let released = false;
    return {
      async release() {
        if (released) return;
        released = true;
        try { await held.commit(); }
        finally { leases.count -= 1; }
      },
    };
  } catch (error) {
    try { if (transaction) await transaction.rollback().catch(() => undefined); }
    finally { leases.count -= 1; }
    throw error;
  }
}
