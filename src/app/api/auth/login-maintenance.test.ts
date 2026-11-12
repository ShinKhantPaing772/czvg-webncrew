import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CREW_LOGIN_DISABLED_MESSAGE } from "@/lib/login-maintenance";

const mocks = vi.hoisted(() => ({
  findPilot: vi.fn(), createPilot: vi.fn(), createApplication: vi.fn(), createToken: vi.fn(),
  comparePassword: vi.fn(), hashPassword: vi.fn(), signToken: vi.fn(), getInfiniteFlightUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  models: {
    Pilot: { findOne: mocks.findPilot, create: mocks.createPilot },
    Application: { create: mocks.createApplication },
    Token: { create: mocks.createToken },
  },
}));
vi.mock("bcryptjs", () => ({ default: { compare: mocks.comparePassword, hash: mocks.hashPassword } }));
vi.mock("jsonwebtoken", () => ({ default: { sign: mocks.signToken } }));
vi.mock("@/lib/infinite-flight-api", () => ({
  getInfiniteFlightUser: mocks.getInfiniteFlightUser,
  findInfiniteFlightUser: vi.fn(),
  InfiniteFlightApiError: class extends Error {},
}));
vi.mock("@/lib/infinite-flight/lookup-rate-limit", () => ({ isIfcLookupRateLimited: vi.fn() }));
vi.mock("@/lib/email", () => ({ applicationReceivedEmail: vi.fn(), getApplicantPortalUrl: vi.fn(), sendEmail: vi.fn() }));

import { POST } from "./route";

function pilotWithStatus(status: number) {
  return { id: 42, email: "pilot@example.com", password: "stored-hash", name: "Test Pilot", callsign: "China Southern 142VG", status };
}

function loginRequest() {
  return new NextRequest("http://localhost/api/auth", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", email: "pilot@example.com", password: "correct-password" }),
  });
}

describe("POST /api/auth manual maintenance switch", () => {
  beforeEach(() => {
    vi.stubEnv("CREW_LOGIN_DISABLED", "true");
    mocks.findPilot.mockReset().mockResolvedValue(pilotWithStatus(1));
    mocks.comparePassword.mockReset().mockResolvedValue(true);
    mocks.signToken.mockReset().mockReturnValue("signed-token");
    mocks.createToken.mockReset().mockResolvedValue({});
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each(["login", "signup"])("blocks %s before reading credentials or writing records", async (action) => {
    const request = new NextRequest("http://localhost/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, email: "pilot@example.com", password: "password" }),
    });
    const readBody = vi.spyOn(request, "json");
    const response = await POST(request);

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      code: "CREW_LOGIN_DISABLED",
      error: CREW_LOGIN_DISABLED_MESSAGE,
    });
    expect(readBody).not.toHaveBeenCalled();
    expect(mocks.findPilot).not.toHaveBeenCalled();
    expect(mocks.comparePassword).not.toHaveBeenCalled();
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.signToken).not.toHaveBeenCalled();
    expect(mocks.createToken).not.toHaveBeenCalled();
    expect(mocks.createPilot).not.toHaveBeenCalled();
    expect(mocks.createApplication).not.toHaveBeenCalled();
    expect(mocks.getInfiniteFlightUser).not.toHaveBeenCalled();
  });

  it.each([undefined, "false"])("keeps normal login available when the switch is %s", async (value) => {
    vi.stubEnv("CREW_LOGIN_DISABLED", value);

    expect((await POST(loginRequest())).status).toBe(200);
    expect(mocks.findPilot).toHaveBeenCalledOnce();
    expect(mocks.createToken).toHaveBeenCalledOnce();
  });

  it("reopens login after maintenance is switched off", async () => {
    expect((await POST(loginRequest())).status).toBe(503);
    vi.stubEnv("CREW_LOGIN_DISABLED", "false");
    expect((await POST(loginRequest())).status).toBe(200);
  });
});
