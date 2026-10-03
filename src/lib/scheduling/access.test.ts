import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "sequelize";

const mocks = vi.hoisted(() => ({
  requireCrewAuth: vi.fn(),
  findPilot: vi.fn(),
  findGrant: vi.fn(),
}));

vi.mock("@/lib/models", () => ({
  models: {
    Pilot: { findByPk: mocks.findPilot },
    AwardGranted: { findOne: mocks.findGrant },
  },
}));
vi.mock("@/lib/server-auth", () => ({ requireCrewAuth: mocks.requireCrewAuth }));

import { canAccessLiveScheduling, livePilotAwardId, requireLivePilotAuth } from "./access";

const authenticated = {
  ok: true,
  token: "valid-token",
  user: { id: 42, email: "pilot@example.com", permissions: [] },
};

beforeEach(() => {
  vi.stubEnv("LIVE_PILOT_AWARD_ID", "7");
  mocks.requireCrewAuth.mockReset().mockResolvedValue(authenticated);
  mocks.findPilot.mockReset().mockResolvedValue({ status: 1 });
  mocks.findGrant.mockReset().mockResolvedValue({ id: 10 });
});

afterEach(() => { vi.unstubAllEnvs(); });

describe("live pilot award configuration", () => {
  it.each(["", "0", "-1", "1.5", "1e2", "invalid", "2147483648"])(
    "fails closed for invalid award ID %j", async (value) => {
      vi.stubEnv("LIVE_PILOT_AWARD_ID", value);
      expect(livePilotAwardId()).toBeNull();
      await expect(canAccessLiveScheduling(42)).resolves.toBe(false);
      expect(mocks.findGrant).not.toHaveBeenCalled();
    },
  );

  it("reads the configured ID at request time", () => {
    expect(livePilotAwardId()).toBe(7);
    vi.stubEnv("LIVE_PILOT_AWARD_ID", " 9 ");
    expect(livePilotAwardId()).toBe(9);
  });
});

describe("live scheduling eligibility", () => {
  it("requires an active pilot and the configured award", async () => {
    await expect(canAccessLiveScheduling(42)).resolves.toBe(true);
    expect(mocks.findGrant).toHaveBeenCalledWith({
      where: { pilotid: 42, awardid: 7 }, attributes: ["id"],
    });
  });

  it.each([0, 2, 3, 99])("denies inactive pilot status %i even with the award", async (status) => {
    await expect(canAccessLiveScheduling(42, status)).resolves.toBe(false);
    expect(mocks.findGrant).not.toHaveBeenCalled();
  });

  it("denies a missing pilot", async () => {
    mocks.findPilot.mockResolvedValue(null);
    await expect(canAccessLiveScheduling(42)).resolves.toBe(false);
  });

  it("rechecks grants so revocation applies without a new login", async () => {
    await expect(canAccessLiveScheduling(42, 1)).resolves.toBe(true);
    mocks.findGrant.mockResolvedValue(null);
    await expect(canAccessLiveScheduling(42, 1)).resolves.toBe(false);
    expect(mocks.findGrant).toHaveBeenCalledTimes(2);
  });

  it("locks and rechecks the pilot before the grant in mutation transactions", async () => {
    const transaction = { LOCK: { UPDATE: "UPDATE" } } as unknown as Transaction;
    await expect(canAccessLiveScheduling(42, 1, transaction)).resolves.toBe(true);
    expect(mocks.findPilot).toHaveBeenCalledWith(42, {
      attributes: ["status"], raw: true, transaction, lock: "UPDATE",
    });
    expect(mocks.findGrant).toHaveBeenCalledWith({
      where: { pilotid: 42, awardid: 7 }, attributes: ["id"], transaction, lock: "UPDATE",
    });
    expect(mocks.findPilot.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.findGrant.mock.invocationCallOrder[0],
    );

    mocks.findPilot.mockResolvedValue({ status: 3 });
    await expect(canAccessLiveScheduling(42, 1, transaction)).resolves.toBe(false);
  });
});

describe("live pilot API authorization", () => {
  const request = new Request("http://localhost/api/scheduling");

  it("preserves crew authentication failures", async () => {
    const failure = { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
    mocks.requireCrewAuth.mockResolvedValue(failure);
    await expect(requireLivePilotAuth(request)).resolves.toBe(failure);
    expect(mocks.findGrant).not.toHaveBeenCalled();
  });

  it("allows eligible pilots", async () => {
    await expect(requireLivePilotAuth(request)).resolves.toBe(authenticated);
  });

  it("requires the award even for admins", async () => {
    mocks.requireCrewAuth.mockResolvedValue({
      ...authenticated, user: { ...authenticated.user, permissions: ["admin"] },
    });
    mocks.findGrant.mockResolvedValue(null);
    const result = await requireLivePilotAuth(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("fails closed when an eligibility lookup fails", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.findGrant.mockRejectedValue(new Error("Database unavailable"));
      const result = await requireLivePilotAuth(request);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(500);
    } finally { logger.mockRestore(); }
  });
});
