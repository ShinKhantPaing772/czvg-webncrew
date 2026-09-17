import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = "test-jwt-secret";

  return {
    verifyToken: vi.fn(),
    findToken: vi.fn(),
    findPilot: vi.fn(),
    findPermissions: vi.fn(),
  };
});

vi.mock("jsonwebtoken", () => {
  class JsonWebTokenError extends Error {}

  return {
    default: {
      verify: mocks.verifyToken,
      JsonWebTokenError,
    },
  };
});

vi.mock("@/lib/models", () => ({
  models: {
    Token: { findOne: mocks.findToken },
    Pilot: { findByPk: mocks.findPilot },
    Permission: { findAll: mocks.findPermissions },
  },
}));

import {
  requireAuth,
  requireCrewAuth,
  requirePermission,
} from "./server-auth";

function authenticatedRequest() {
  return new Request("http://localhost/api/test", {
    headers: { Authorization: "Bearer valid-token" },
  });
}

describe("server authorization by pilot status", () => {
  beforeEach(() => {
    mocks.verifyToken.mockReset().mockReturnValue({
      id: 42,
      email: "pilot@example.com",
    });
    mocks.findToken.mockReset().mockResolvedValue({
      pilotId: 42,
      expiresAt: new Date(Date.now() + 60_000),
      isRevoked: false,
    });
    mocks.findPilot.mockReset().mockResolvedValue({ status: 1 });
    mocks.findPermissions.mockReset().mockResolvedValue([]);
  });

  it("keeps generic authentication available for the applicant portal", async () => {
    const result = await requireAuth(authenticatedRequest());

    expect(result.ok).toBe(true);
    expect(mocks.findPilot).not.toHaveBeenCalled();
  });

  it("allows an approved pilot to access crew APIs", async () => {
    const result = await requireCrewAuth(authenticatedRequest());

    expect(result.ok).toBe(true);
    expect(mocks.findPilot).toHaveBeenCalledWith(42, {
      attributes: ["status"],
      raw: true,
    });
  });

  it.each([0, 2, 3, 99])(
    "denies crew API access to pilot status %i",
    async (status) => {
      mocks.findPilot.mockResolvedValue({ status });

      const result = await requireCrewAuth(authenticatedRequest());

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.response.status).toBe(403);
      await expect(result.response.json()).resolves.toMatchObject({
        error: "Crew Center access requires an active pilot account",
      });
    },
  );

  it("denies a missing pilot record", async () => {
    mocks.findPilot.mockResolvedValue(null);

    const result = await requireCrewAuth(authenticatedRequest());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
  });

  it("denies inactive former admins even when their permission remains", async () => {
    mocks.findPilot.mockResolvedValue({ status: 3 });
    mocks.findPermissions.mockResolvedValue([{ name: "admin" }]);

    const result = await requirePermission(authenticatedRequest(), "home");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
  });
});
