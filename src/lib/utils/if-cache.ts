import { QueryTypes } from "sequelize";
import sequelize from "@/lib/database";

type CacheEntry<T> = {
  expiresAt: number;
  data: T;
};

const TABLE_NAME = "api_cache";
let tableInitialized = false;
const cacheStore: Map<string, CacheEntry<unknown>> = new Map();

async function ensureCacheTable() {
  if (tableInitialized) {
    return;
  }

  try {
    await sequelize.query(
      `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        cache_key VARCHAR(255) NOT NULL PRIMARY KEY,
        value LONGTEXT NOT NULL,
        expires_at BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
      { type: QueryTypes.RAW },
    );
    tableInitialized = true;
  } catch (error) {
    console.error("[IF Cache] Table initialization failed:", error);
  }
}

async function cleanupExpiredDbCache() {
  if (!tableInitialized) {
    return;
  }

  try {
    await sequelize.query(`DELETE FROM ${TABLE_NAME} WHERE expires_at < ?`, {
      replacements: [Date.now()],
      type: QueryTypes.DELETE,
    });
  } catch (error) {
    console.error("[IF Cache] DB cleanup error:", error);
  }
}

function cleanupMemoryCache() {
  const now = Date.now();
  for (const [key, entry] of cacheStore.entries()) {
    if (now > entry.expiresAt) {
      cacheStore.delete(key);
    }
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    await ensureCacheTable();

    if (tableInitialized) {
      await cleanupExpiredDbCache();

      const rows = await sequelize.query<{
        value: string;
        expires_at: string | number;
      }>(
        `SELECT value, expires_at FROM ${TABLE_NAME} WHERE cache_key = ? LIMIT 1`,
        {
          replacements: [key],
          type: QueryTypes.SELECT,
        },
      );

      const row = rows[0];
      if (!row) {
        return null;
      }

      const expiresAt = Number(row.expires_at);
      if (Date.now() > expiresAt) {
        await sequelize.query(`DELETE FROM ${TABLE_NAME} WHERE cache_key = ?`, {
          replacements: [key],
          type: QueryTypes.DELETE,
        });
        return null;
      }

      return JSON.parse(row.value) as T;
    }
  } catch (error) {
    console.error("[IF Cache] DB read error:", error);
  }

  const cached = cacheStore.get(key) as CacheEntry<T> | undefined;
  if (!cached) {
    return null;
  }
  if (Date.now() > cached.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  return cached.data;
}

export async function setCached<T>(key: string, data: T, ttlSeconds: number) {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const entry: CacheEntry<T> = {
    data,
    expiresAt,
  };

  const value = JSON.stringify(entry);

  try {
    await ensureCacheTable();

    if (tableInitialized) {
      await cleanupExpiredDbCache();

      await sequelize.query(
        `INSERT INTO ${TABLE_NAME} (cache_key, value, expires_at)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value), expires_at = VALUES(expires_at)`,
        {
          replacements: [key, value, expiresAt],
          type: QueryTypes.INSERT,
        },
      );
      return;
    }
  } catch (error) {
    console.error("[IF Cache] DB write error:", error);
  }

  cleanupMemoryCache();
  cacheStore.set(key, entry);
}
