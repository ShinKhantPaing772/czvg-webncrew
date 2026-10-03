import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  findAward: vi.fn(),
  deleteAward: vi.fn(),
  countAircraft: vi.fn(),
  countGrants: vi.fn(),
}));

vi.mock("@/lib/database", () => ({ default: {} }));
vi.mock("@/lib/server-auth", () => ({
  requirePermission: mocks.authorize,
  requireCrewAuth: vi.fn(),
}));
vi.mock("@/lib/models", () => ({
  models: {
    Award: { findByPk: mocks.findAward, destroy: mocks.deleteAward },
    Aircraft: { count: mocks.countAircraft },
    AwardGranted: { count: mocks.countGrants },
  },
}));

import { DELETE } from "./route";

beforeEach(() => {
  vi.stubEnv("LIVE_PILOT_AWARD_ID", "7");
  mocks.authorize.mockReset().mockResolvedValue({ ok: true });
  mocks.findAward.mockReset().mockResolvedValue({ id: 8 });
  mocks.deleteAward.mockReset().mockResolvedValue(1);
  mocks.countAircraft.mockReset().mockResolvedValue(0);
  mocks.countGrants.mockReset().mockResolvedValue(0);
});

afterEach(() => { vi.unstubAllEnvs(); });

describe("live pilot award deletion protection", () => {
  it("protects the configured live award even before any pilot grants exist", async () => {
    const response = await DELETE(new Request("http://localhost/api/admin/awards?id=7"));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ message: expect.stringContaining("live scheduling access") });
    expect(mocks.deleteAward).not.toHaveBeenCalled();
  });

  it("allows deletion of an unused unrelated award", async () => {
    expect((await DELETE(new Request("http://localhost/api/admin/awards?id=8"))).status).toBe(200);
    expect(mocks.deleteAward).toHaveBeenCalledOnce();
  });
});
