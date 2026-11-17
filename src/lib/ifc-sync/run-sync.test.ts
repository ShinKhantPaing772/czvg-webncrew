import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: { connect: vi.fn(), end: vi.fn() },
  loadPilots: vi.fn(), applyPlans: vi.fn(),
  ensureApiCacheTable: vi.fn(), fetchUsersInBatches: vi.fn(), buildPlans: vi.fn(),
}));
vi.mock("pg", () => ({ default: { Client: class { constructor() { return mocks.client; } } } }));
vi.mock("./database.mjs", () => ({
  databaseConfiguration: () => ({}), loadPilots: mocks.loadPilots, applyPlans: mocks.applyPlans,
}));
vi.mock("./cache.mjs", () => ({ ensureApiCacheTable: mocks.ensureApiCacheTable }));
vi.mock("./infinite-flight.mjs", () => ({ fetchUsersInBatches: mocks.fetchUsersInBatches }));
vi.mock("./plans.mjs", () => ({ buildPlans: mocks.buildPlans, markConflicts: vi.fn(), describePlan: () => "planned update" }));

import { runSync } from "./run-sync.mjs";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("IF_API", "test-api-key");
  vi.spyOn(console, "log").mockImplementation(() => {});
  mocks.loadPilots.mockResolvedValue([{ id: 1, ifuserid: "", ifc: "pilot" }]);
  mocks.fetchUsersInBatches.mockResolvedValue([]);
  mocks.buildPlans.mockReturnValue([{ changed: true, conflict: false, status: "verified" }]);
  mocks.applyPlans.mockResolvedValue(1);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("IFC sync command", () => {
  it("keeps the default audit from applying identity changes", async () => {
    expect(await runSync([])).toBe(0);
    expect(mocks.applyPlans).not.toHaveBeenCalled();
    expect(mocks.client.end).toHaveBeenCalledOnce();
  });

  it("applies audited plans only when explicitly requested", async () => {
    expect(await runSync(["--apply"])).toBe(0);
    expect(mocks.applyPlans).toHaveBeenCalledWith(mocks.client, mocks.buildPlans.mock.results[0].value);
    expect(mocks.client.end).toHaveBeenCalledOnce();
  });

  it("closes its pg client if auditing fails", async () => {
    mocks.fetchUsersInBatches.mockRejectedValue(new Error("IF is unavailable"));
    await expect(runSync([])).rejects.toThrow("IF is unavailable");
    expect(mocks.applyPlans).not.toHaveBeenCalled();
    expect(mocks.client.end).toHaveBeenCalledOnce();
  });
});
