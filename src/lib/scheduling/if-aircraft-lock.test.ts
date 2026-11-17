import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  database: {
    transaction: vi.fn(),
    query: vi.fn(),
  },
}));

vi.mock("@/lib/database", () => ({ default: mocks.database }));
vi.mock("@/lib/database-config.mjs", () => ({ databasePoolMax: () => 2 }));

beforeEach(() => {
  vi.resetModules();
  mocks.database.transaction.mockReset().mockImplementation(async () => ({
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
  }));
  mocks.database.query.mockReset().mockResolvedValue([{ acquired: true }]);
});

describe("aircraft lock budget across route bundles", () => {
  it("reserves the checkpoint connection when a second bundle shares the pool", async () => {
    const firstBundle = await import("./if-aircraft-lock");
    const firstLease = await firstBundle.acquireIfAircraftLock(1);
    expect(firstLease).not.toBeNull();
    vi.resetModules();
    const secondBundle = await import("./if-aircraft-lock");

    try {
      expect(await secondBundle.acquireIfAircraftLock(2)).toBeNull();
      expect(mocks.database.transaction).toHaveBeenCalledTimes(1);
    } finally {
      await firstLease?.release();
      await firstLease?.release();
    }

    const secondLease = await secondBundle.acquireIfAircraftLock(2);
    expect(secondLease).not.toBeNull();
    try {
      expect(await firstBundle.acquireIfAircraftLock(3)).toBeNull();
    } finally {
      await secondLease?.release();
    }
  });
});
