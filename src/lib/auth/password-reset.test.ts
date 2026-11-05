import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findOtp: vi.fn(),
  destroyOtp: vi.fn(),
  findPilots: vi.fn(),
  updatePilot: vi.fn(),
  destroyTokens: vi.fn(),
  compare: vi.fn(),
  hash: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: { transaction: mocks.transaction },
  models: {
    OTP: { findOne: mocks.findOtp },
    Pilot: { findAll: mocks.findPilots, update: mocks.updatePilot },
    Token: { destroy: mocks.destroyTokens },
  },
}));

vi.mock("bcryptjs", () => ({
  default: { compare: mocks.compare, hash: mocks.hash },
}));

vi.mock("@/lib/auth/password-reset-email", () => ({
  sendPasswordResetOtp: vi.fn(),
}));

import { resetPassword } from "./password-reset";

const transaction = { id: "reset-transaction" };

describe("resetPassword", () => {
  beforeEach(() => {
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
  });

  it("keeps sessions when the code is wrong", async () => {
    mocks.compare.mockResolvedValue(false);

    const response = await resetPassword(
      "other@example.com",
      "000000",
      "new-password",
    );

    expect(response.status).toBe(400);
    expect(mocks.updatePilot).not.toHaveBeenCalled();
    expect(mocks.destroyTokens).not.toHaveBeenCalled();
  });
});
