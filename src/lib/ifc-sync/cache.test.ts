import { describe, expect, it, vi } from "vitest";
import { getCachedUserPayload, setCachedUserPayload } from "./cache.mjs";

describe("IFC script PostgreSQL cache", () => {
  it("accepts pg result rows and expires_at strings", async () => {
    const expiresAt = Date.now() + 60_000;
    const data = { result: [{ userId: "user" }] };
    const connection = { query: vi.fn().mockResolvedValue({ rows: [{ value: JSON.stringify({ data, expiresAt }), expires_at: String(expiresAt) }] }) };
    expect(await getCachedUserPayload(connection, { userIds: ["USER"] })).toEqual(data);
  });

  it("keeps cache key normalization consistent between reads and writes", async () => {
    const connection = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    await getCachedUserPayload(connection, { userIds: ["B", "a"] });
    await setCachedUserPayload(connection, { userIds: ["A", "b"] }, { result: [] });
    expect(connection.query.mock.calls[0][1][0]).toEqual(connection.query.mock.calls[1][1][0]);
    expect(connection.query.mock.calls[1][1][1]).toBe('{"result":[]}');
  });
});
