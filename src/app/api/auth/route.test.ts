import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  findPilot: vi.fn(),
  createPilot: vi.fn(),
  createApplication: vi.fn(),
  createToken: vi.fn(),
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
  signToken: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: mocks.after,
}));

vi.mock("@/lib/db", () => ({
  models: {
    Pilot: { findOne: mocks.findPilot, create: mocks.createPilot },
    Application: { create: mocks.createApplication },
    Token: { create: mocks.createToken },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: mocks.comparePassword,
    hash: mocks.hashPassword,
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
  sendEmail: mocks.sendEmail,
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

describe("POST /api/auth signup follow-up work", () => {
  const webhookUrl = "https://discord.test/admin-webhook";
  let consoleError: ReturnType<typeof vi.spyOn>;

  function signupRequest() {
    return new NextRequest("http://localhost/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "signup",
        email: " New.Pilot@Example.com ",
        password: "a-long-password",
        name: "New Pilot",
        ifc: "newpilot",
        ifUserId: "if-user-1",
        ifGrade: 3,
        ifViolations: 0,
      }),
    });
  }

  async function runAfterCallbacks() {
    for (const [callback] of mocks.after.mock.calls) {
      await callback();
    }
  }

  beforeEach(() => {
    mocks.findPilot.mockReset().mockResolvedValue(null);
    mocks.hashPassword.mockReset().mockResolvedValue("password-hash");
    mocks.createPilot.mockReset().mockImplementation(async (values) => ({
      id: 77,
      ...values,
    }));
    mocks.createApplication.mockReset().mockResolvedValue({});
    mocks.createToken.mockReset().mockResolvedValue({});
    mocks.signToken.mockReset().mockReturnValue("signed-token");
    mocks.sendEmail.mockReset().mockResolvedValue(true);
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.DISCORD_WEBHOOK_ADMIN;
    vi.unstubAllGlobals();
    consoleError.mockRestore();
  });

  it("completes the signup when Discord is unreachable", async () => {
    process.env.DISCORD_WEBHOOK_ADMIN = webhookUrl;
    const fetchMock = vi.fn().mockRejectedValue(new Error("Discord is down"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(signupRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      token: "signed-token",
      redirectTo: "/crew/application",
      user: { id: 77, email: "new.pilot@example.com", status: 0 },
    });
    // The webhook and the email both wait until the response has been sent.
    expect(mocks.after).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();

    await expect(runAfterCallbacks()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      webhookUrl,
      expect.objectContaining({ method: "POST" }),
    );
    expect(consoleError).toHaveBeenCalledWith(
      "[Signup] Discord webhook failed:",
      expect.any(Error),
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: { email: "new.pilot@example.com", name: "New Pilot" },
      }),
    );
  });

  it("logs an email that fails after the response", async () => {
    mocks.sendEmail.mockRejectedValue(new Error("Brevo is down"));

    const response = await POST(signupRequest());
    expect(response.status).toBe(201);
    expect(mocks.after).toHaveBeenCalledTimes(1);

    await expect(runAfterCallbacks()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "[Signup] Failed to send application received email:",
      expect.any(Error),
    );
  });
});
