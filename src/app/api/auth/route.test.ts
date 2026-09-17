import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findPilot: vi.fn(),
  createToken: vi.fn(),
  comparePassword: vi.fn(),
  signToken: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  models: {
    Pilot: { findOne: mocks.findPilot },
    Token: { create: mocks.createToken },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: mocks.comparePassword,
    hash: vi.fn(),
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: mocks.signToken,
  },
}));

vi.mock("@/lib/email", () => ({
  applicationReceivedEmail: vi.fn(),
  getApplicantPortalUrl: vi.fn(),
  sendEmail: vi.fn(),
}));

import { POST } from "./route";

function loginRequest(password = "correct-password") {
  return new NextRequest("http://localhost/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "login",
      email: " Pilot@Example.com ",
      password,
    }),
  });
}

function pilotWithStatus(status: number) {
  return {
    id: 42,
    email: "pilot@example.com",
    password: "stored-hash",
    name: "Test Pilot",
    callsign: "China Southern 142VG",
    status,
  };
}

describe("POST /api/auth login status routing", () => {
  beforeEach(() => {
    mocks.findPilot.mockReset();
    mocks.createToken.mockReset().mockResolvedValue({});
    mocks.comparePassword.mockReset().mockResolvedValue(true);
    mocks.signToken.mockReset().mockReturnValue("signed-token");
  });

  it.each([
    [2, "rejected"],
    [3, "inactive"],
  ])(
    "lets a %s (%s) pilot log in to the applicant portal",
    async (status) => {
      mocks.findPilot.mockResolvedValue(pilotWithStatus(status));

      const response = await POST(loginRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        token: "signed-token",
        redirectTo: "/crew/application",
        user: { id: 42, status },
      });
      expect(mocks.findPilot).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: "pilot@example.com" },
        }),
      );
      expect(mocks.comparePassword).toHaveBeenCalledWith(
        "correct-password",
        "stored-hash",
      );
      expect(mocks.createToken).toHaveBeenCalledWith({
        pilotId: 42,
        token: "signed-token",
        expiresAt: expect.any(Date),
      });
    },
  );

  it("continues routing an approved pilot to the crew dashboard", async () => {
    mocks.findPilot.mockResolvedValue(pilotWithStatus(1));

    const response = await POST(loginRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.redirectTo).toBe("/crew/home");
  });

  it.each([1, 2, 3])(
    "rejects an incorrect password for status %i",
    async (status) => {
      mocks.findPilot.mockResolvedValue(pilotWithStatus(status));
      mocks.comparePassword.mockResolvedValue(false);

      const response = await POST(loginRequest("wrong-password"));
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe(
        "Invalid credentials. Please check your email and password.",
      );
      expect(mocks.signToken).not.toHaveBeenCalled();
      expect(mocks.createToken).not.toHaveBeenCalled();
    },
  );

  it("rejects an unknown account status after checking the password", async () => {
    mocks.findPilot.mockResolvedValue(pilotWithStatus(99));

    const response = await POST(loginRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("This account is not available for login.");
    expect(mocks.comparePassword).toHaveBeenCalled();
    expect(mocks.signToken).not.toHaveBeenCalled();
    expect(mocks.createToken).not.toHaveBeenCalled();
  });
});
