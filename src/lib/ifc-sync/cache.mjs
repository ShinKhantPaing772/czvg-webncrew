import { createHash } from "node:crypto";
import { normalized, stringValue } from "./values.mjs";

const IF_USER_CACHE_TTL_MS = 5 * 60 * 1_000;
const IF_CACHE_TABLE = "api_cache";

function userSearchCacheKey(search) {
  const canonicalSearch = Object.fromEntries(
    Object.entries(search)
      .filter(([, values]) => Array.isArray(values))
      .map(([key, values]) => [
        key,
        values
          .map((value) =>
            key === "userHashes"
              ? stringValue(value).toUpperCase()
              : normalized(value),
          )
          .filter(Boolean)
          .sort(),
      ])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const digest = createHash("sha256")
    .update(JSON.stringify(canonicalSearch))
    .digest("hex");
  return `if-users-batch-${digest}`;
}

function unwrapCachedPayload(value, expiresAt) {
  const parsed = JSON.parse(value);
  if (
    parsed &&
    typeof parsed === "object" &&
    Object.hasOwn(parsed, "data") &&
    Object.hasOwn(parsed, "expiresAt") &&
    Number(parsed.expiresAt) === expiresAt
  ) {
    return parsed.data;
  }
  return parsed;
}

export async function ensureApiCacheTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS ${IF_CACHE_TABLE} (
      cache_key VARCHAR(255) NOT NULL PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at BIGINT NOT NULL
    )
  `);
  await connection.query(`CREATE INDEX IF NOT EXISTS idx_api_cache_expires_at ON ${IF_CACHE_TABLE} (expires_at)`);
  await connection.query(
    `DELETE FROM ${IF_CACHE_TABLE} WHERE expires_at <= $1`,
    [Date.now()],
  );
}

export async function getCachedUserPayload(connection, search) {
  const cacheKey = userSearchCacheKey(search);
  const now = Date.now();
  const { rows } = await connection.query(
    `
      SELECT value, expires_at
      FROM ${IF_CACHE_TABLE}
      WHERE cache_key = $1 AND expires_at > $2
      LIMIT 1
    `,
    [cacheKey, now],
  );
  const row = rows[0];
  if (!row) return null;

  try {
    return unwrapCachedPayload(row.value, Number(row.expires_at));
  } catch {
    await connection.query(
      `DELETE FROM ${IF_CACHE_TABLE} WHERE cache_key = $1`,
      [cacheKey],
    );
    return null;
  }
}

export async function setCachedUserPayload(connection, search, payload) {
  const cacheKey = userSearchCacheKey(search);
  const expiresAt = Date.now() + IF_USER_CACHE_TTL_MS;
  await connection.query(
    `
      INSERT INTO ${IF_CACHE_TABLE} (cache_key, value, expires_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (cache_key) DO UPDATE SET
        value = EXCLUDED.value,
        expires_at = EXCLUDED.expires_at
    `,
    [cacheKey, JSON.stringify(payload), expiresAt],
  );
}
