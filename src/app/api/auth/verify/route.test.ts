import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = "test-jwt-secret";
  return {
    verify: vi.fn(),
    findToken: vi.fn(),
    deleteTokens: vi.fn(),
    findPilot: vi.fn(),
    findGrant: vi.fn(),
  };
});

vi.mock("jsonwebtoken", () => {
  class JsonWebTokenError extends Error {}
  return { default: { verify: mocks.verify, JsonWebTokenError } };
});
vi.mock("@/lib/models", () => ({
  models: {
    Token: { findOne: mocks.findToken, destroy: mocks.deleteTokens },
    Pilot: { findByPk: mocks.findPilot },
    Permission: {},
    AwardGranted: { findOne: mocks.findGrant },
  },
}));

import { POST } from "./route";

function request() {
  return new Request("http://localhost/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "valid-token" }),
  });
}

beforeEach(() => {
  vi.stubEnv("LIVE_PILOT_AWARD_ID", "7");
  mocks.verify.mockReset().mockReturnValue({ id: 42 });
  mocks.findToken.mockReset().mockResolvedValue({
    pilotId: 42, expiresAt: new Date(Date.now() + 60_000), isRevoked: false,
  });
  mocks.deleteTokens.mockReset().mockResolvedValue(0);
  const pilot = { id: 42, status: 1, name: "Live pilot", Permissions: [] };
  mocks.findPilot.mockReset().mockResolvedValue({ ...pilot, toJSON: () => pilot });
  mocks.findGrant.mockReset().mockResolvedValue({ id: 10 });
});

afterEach(() => { vi.unstubAllEnvs(); });

describe("session verification live scheduling capability", () => {
  it("returns the existing session fields and award-derived capability", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: 42, status: 1, name: "Live pilot", Permissions: [], canAccessLiveScheduling: true,
    });
    expect(mocks.findGrant).toHaveBeenCalledWith({
      where: { pilotid: 42, awardid: 7 }, attributes: ["id"],
    });
  });

  it("reports false after award revocation", async () => {
    mocks.findGrant.mockResolvedValue(null);
    await expect((await POST(request())).json()).resolves.toMatchObject({ canAccessLiveScheduling: false });
  });

  it("reports false for inactive pilots even if they still hold the award", async () => {
    const pilot = { id: 42, status: 3, Permissions: [] };
    mocks.findPilot.mockResolvedValue({ ...pilot, toJSON: () => pilot });
    await expect((await POST(request())).json()).resolves.toMatchObject({ canAccessLiveScheduling: false });
    expect(mocks.findGrant).not.toHaveBeenCalled();
  });

  it("keeps session verification available before the award is configured", async () => {
    vi.stubEnv("LIVE_PILOT_AWARD_ID", "");
    const response = await POST(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ canAccessLiveScheduling: false });
  });

  it("does not expose capability for a mismatched persisted token", async () => {
    mocks.findToken.mockResolvedValue({
      pilotId: 99, expiresAt: new Date(Date.now() + 60_000), isRevoked: false,
    });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.findGrant).not.toHaveBeenCalled();
  });
});
