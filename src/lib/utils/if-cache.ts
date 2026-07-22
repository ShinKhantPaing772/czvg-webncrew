import { QueryTypes } from "sequelize";
import sequelize from "@/lib/database";

type CacheEntry<T> = {
  expiresAt: number;
  data: T;
};

const TABLE_NAME = "api_cache";
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

let tableInitialized = false;
let tableInitialization: Promise<boolean> | null = null;
let lastCleanupAt = 0;

function assertCacheKey(key: string) {
  if (!key || key.length > 255) {
    throw new Error("IF cache keys must contain between 1 and 255 characters");
  }
}

function unwrapStoredValue<T>(value: string, expiresAt: number): T {
  const parsed = JSON.parse(value) as unknown;

  // Older cache rows stored the in-memory cache envelope in `value`, even
  // though `expires_at` already stores the expiry. Read those rows correctly
  // until their short TTL naturally replaces them with the fixed format.
  if (
    parsed &&
    typeof parsed === "object" &&
    "data" in parsed &&
    "expiresAt" in parsed &&
    Number((parsed as CacheEntry<unknown>).expiresAt) === expiresAt
  ) {
    return (parsed as CacheEntry<T>).data;
  }

  return parsed as T;
}

async function cleanupExpiredDbCache() {
  if (!tableInitialized) return;

  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  try {
    await sequelize.query(`DELETE FROM ${TABLE_NAME} WHERE expires_at <= ?`, {
      replacements: [now],
      type: QueryTypes.DELETE,
    });
  } catch (error) {
    console.error("[IF Cache] DB cleanup error:", error);
  }
}

async function ensureCacheTable() {
  if (tableInitialized) return true;
  if (tableInitialization) return tableInitialization;

  tableInitialization = (async () => {
    try {
      await sequelize.query(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          cache_key VARCHAR(255) NOT NULL PRIMARY KEY,
          value LONGTEXT NOT NULL,
          expires_at BIGINT NOT NULL,
          KEY idx_api_cache_expires_at (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
        { type: QueryTypes.RAW },
      );
      tableInitialized = true;
      return true;
    } catch (error) {
      console.error("[IF Cache] Table initialization failed:", error);
      return false;
    } finally {
      if (!tableInitialized) tableInitialization = null;
    }
  })();

  return tableInitialization;
}

export async function getCached<T>(key: string): Promise<T | null> {
  assertCacheKey(key);

  try {
    const databaseAvailable = await ensureCacheTable();
    if (!databaseAvailable) {
      throw new Error("Infinite Flight database cache is unavailable");
    }

    const now = Date.now();
    const rows = await sequelize.query<{
      value: string;
      expires_at: string | number;
    }>(
      `SELECT value, expires_at
       FROM ${TABLE_NAME}
       WHERE cache_key = ? AND expires_at > ?
       LIMIT 1`,
      {
        replacements: [key, now],
        type: QueryTypes.SELECT,
      },
    );

    const row = rows[0];
    if (!row) return null;

    try {
      return unwrapStoredValue<T>(row.value, Number(row.expires_at));
    } catch (error) {
      console.warn("[IF Cache] Removed an unreadable cache row:", { key, error });
      await sequelize.query(`DELETE FROM ${TABLE_NAME} WHERE cache_key = ?`, {
        replacements: [key],
        type: QueryTypes.DELETE,
      });
      return null;
    }
  } catch (error) {
    console.error("[IF Cache] DB read error:", error);
    throw error;
  }
}

export async function setCached<T>(key: string, data: T, ttlSeconds: number) {
  assertCacheKey(key);
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("IF cache TTL must be a positive number of seconds");
  }

  const expiresAt = Date.now() + ttlSeconds * 1000;
  const value = JSON.stringify(data);

  if (value === undefined) {
    throw new Error("IF cache values must be JSON serializable");
  }

  try {
    const databaseAvailable = await ensureCacheTable();
    if (!databaseAvailable) {
      throw new Error("Infinite Flight database cache is unavailable");
    }

    await cleanupExpiredDbCache();
    await sequelize.query(
      `INSERT INTO ${TABLE_NAME} (cache_key, value, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         value = VALUES(value),
         expires_at = VALUES(expires_at)`,
      {
        replacements: [key, value, expiresAt],
        type: QueryTypes.INSERT,
      },
    );
  } catch (error) {
    console.error("[IF Cache] DB write error:", error);
    throw error;
  }
}

export async function deleteCached(key: string) {
  assertCacheKey(key);

  try {
    const databaseAvailable = await ensureCacheTable();
    if (!databaseAvailable) {
      throw new Error("Infinite Flight database cache is unavailable");
    }

    await sequelize.query(`DELETE FROM ${TABLE_NAME} WHERE cache_key = ?`, {
      replacements: [key],
      type: QueryTypes.DELETE,
    });
  } catch (error) {
    console.error("[IF Cache] DB delete error:", error);
    throw error;
  }
}
