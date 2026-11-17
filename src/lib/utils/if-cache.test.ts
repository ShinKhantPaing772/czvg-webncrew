import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/database", () => ({ default: { query: mocks.query } }));

beforeEach(() => {
  vi.resetModules();
  mocks.query.mockReset();
  mocks.query.mockResolvedValue([]);
});

describe("PostgreSQL IF cache", () => {
  it("reads legacy cache envelopes with PostgreSQL bigint expiry values", async () => {
    const { getCached } = await import("./if-cache");
    const expiresAt = Date.now() + 60_000;
    mocks.query.mockImplementation(async (sql: string) => sql.startsWith("SELECT")
      ? [{ value: JSON.stringify({ expiresAt, data: { result: [1] } }), expires_at: String(expiresAt) }]
      : []);
    expect(await getCached("legacy")).toEqual({ result: [1] });
  });

  it("returns the count from its atomic upsert instead of a later shared-row read", async () => {
    const { incrementCounter } = await import("./if-cache");
    mocks.query.mockImplementation(async (sql: string) => sql.startsWith("INSERT") ? [{ value: "4" }] : []);
    expect(await incrementCounter("limit:pilot", 600)).toBe(4);
    expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith("SELECT"))).toBe(false);
  });

  it("removes unreadable rows and propagates database failures", async () => {
    const { getCached, incrementCounter } = await import("./if-cache");
    mocks.query.mockImplementation(async (sql: string) => sql.startsWith("SELECT") ? [{ value: "invalid json", expires_at: "9999999999999" }] : []);
    expect(await getCached("bad")).toBeNull();
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM api_cache WHERE cache_key"), expect.objectContaining({ replacements: ["bad"] }));
    mocks.query.mockRejectedValue(new Error("unavailable"));
    await expect(incrementCounter("limit:pilot", 600)).rejects.toThrow("unavailable");
  });
});
