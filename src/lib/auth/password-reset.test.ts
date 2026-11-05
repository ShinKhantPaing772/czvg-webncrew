import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findOtp: vi.fn(),
  destroyOtp: vi.fn(),
  findPilot: vi.fn(),
  findPilots: vi.fn(),
  updatePilot: vi.fn(),
  destroyTokens: vi.fn(),
  compare: vi.fn(),
  hash: vi.fn(),
  incrementCounter: vi.fn(),
  deleteCached: vi.fn(),
  sendOtp: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: { transaction: mocks.transaction },
  models: {
    OTP: { findOne: mocks.findOtp, destroy: vi.fn(), create: vi.fn() },
    Pilot: {
      findOne: mocks.findPilot,
      findAll: mocks.findPilots,
      update: mocks.updatePilot,
    },
    Token: { destroy: mocks.destroyTokens },
  },
}));

vi.mock("@/lib/utils/if-cache", () => ({
  incrementCounter: mocks.incrementCounter,
  deleteCached: mocks.deleteCached,
}));

vi.mock("bcryptjs", () => ({
  default: { compare: mocks.compare, hash: mocks.hash },
}));

vi.mock("@/lib/auth/password-reset-email", () => ({
  sendPasswordResetOtp: mocks.sendOtp,
}));

import {
  requestPasswordResetOtp,
  resetPassword,
  verifyPasswordResetOtp,
} from "./password-reset";

const transaction = { id: "reset-transaction" };
const HASHED_KEY = /^rate:password-reset:(request|verify):[0-9a-f]{64}$/;

describe("resetPassword", () => {
  beforeEach(() => {
    mocks.incrementCounter.mockResolvedValue(1);
    mocks.transaction.mockImplementation(async (callback) =>
      callback(transaction),
    );
    mocks.findOtp.mockResolvedValue({
      otp: "otp-hash",
      expires: new Date(Date.now() + 60_000),
      destroy: mocks.destroyOtp,
    });
    mocks.findPilots.mockResolvedValue([{ id: 42 }]);
    mocks.hash.mockResolvedValue("new-password-hash");
  });

  it("signs every device out when the password changes", async () => {
    mocks.compare.mockResolvedValue(true);

    const response = await resetPassword(
      "pilot@example.com",
      "123456",
      "new-password",
    );

    expect(response.status).toBe(200);
    expect(mocks.updatePilot).toHaveBeenCalledWith(
      { password: "new-password-hash" },
      { where: { email: "pilot@example.com" }, transaction },
    );
    expect(mocks.destroyTokens).toHaveBeenCalledWith({
      where: { pilotId: [42] },
      transaction,
    });
    expect(mocks.destroyOtp).toHaveBeenCalledWith({ transaction });
    // Both attempt counters are cleared after a successful reset.
    expect(mocks.deleteCached).toHaveBeenCalledTimes(2);
  });

  it("keeps sessions when the code is wrong", async () => {
    mocks.compare.mockResolvedValue(false);

    const response = await resetPassword(
      "pilot@example.com",
      "000000",
      "new-password",
    );

    expect(response.status).toBe(400);
    expect(mocks.updatePilot).not.toHaveBeenCalled();
    expect(mocks.destroyTokens).not.toHaveBeenCalled();
  });
});

describe("password reset attempt limits", () => {
  it("refuses a fourth code request in the window", async () => {
    mocks.incrementCounter.mockResolvedValue(4);

    const response = await requestPasswordResetOtp("pilot@example.com");

    expect(response.status).toBe(429);
    expect(mocks.findPilot).not.toHaveBeenCalled();
  });

  it("stops checking codes after five wrong attempts", async () => {
    mocks.incrementCounter.mockResolvedValue(6);

    const response = await verifyPasswordResetOtp(
      "pilot@example.com",
      "123456",
    );

    expect(response.status).toBe(429);
    expect(mocks.findOtp).not.toHaveBeenCalled();
    expect(mocks.compare).not.toHaveBeenCalled();
  });

  it("gives a newly sent code a fresh set of attempts", async () => {
    mocks.incrementCounter.mockResolvedValue(1);
    mocks.findPilot.mockResolvedValue({ id: 42, email: "pilot@example.com" });
    mocks.sendOtp.mockResolvedValue(true);

    const response = await requestPasswordResetOtp("pilot@example.com");

    expect(response.status).toBe(200);
    expect(mocks.deleteCached).toHaveBeenCalledWith(
      expect.stringMatching(/^rate:password-reset:verify:/),
    );
  });

  it("counts attempts in the shared store under a hashed key", async () => {
    mocks.incrementCounter.mockResolvedValue(6);

    await verifyPasswordResetOtp("pilot@example.com", "123456");

    const [key, windowSeconds] = mocks.incrementCounter.mock.calls[0];
    expect(key).toMatch(HASHED_KEY);
    expect(key).not.toContain("pilot@example.com");
    expect(windowSeconds).toBe(15 * 60);
  });
});
