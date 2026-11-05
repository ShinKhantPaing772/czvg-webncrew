import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  requireCrewAuth: vi.fn(),
  canPilotUseAircraft: vi.fn(),
  findAircraft: vi.fn(),
  findDuplicatePirep: vi.fn(),
  createPirep: vi.fn(),
  createComment: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: mocks.after,
}));

vi.mock("@/lib/server-auth", () => ({
  requireCrewAuth: mocks.requireCrewAuth,
}));

vi.mock("@/lib/aircraft-eligibility", () => ({
  canPilotUseAircraft: mocks.canPilotUseAircraft,
}));

vi.mock("@/lib/database", () => ({
  default: { transaction: mocks.transaction },
}));

vi.mock("@/lib/models", () => ({
  models: {
    Aircraft: { findOne: mocks.findAircraft },
    Multiplier: { findOne: vi.fn() },
    Rank: { findByPk: vi.fn() },
    Pirep: {
      findOne: mocks.findDuplicatePirep,
      create: mocks.createPirep,
      sum: vi.fn(),
    },
    PirepComment: { create: mocks.createComment },
  },
}));

import { POST } from "./route";

const WEBHOOK_URL = "https://discord.test/pirep-webhook";

function pirepRequest() {
  return new NextRequest("http://localhost/api/pireps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      flightnum: "CSN3101",
      departure: "zggg",
      arrival: "ZBAA",
      flightTime: "03:05",
      date: new Date().toISOString(),
      aircraftId: 7,
      fuelUsed: "12000",
      multi: "",
      pilotid: 42,
      pilotname: "Test Pilot",
      pilotcallsign: "China Southern 142VG",
      notes: "",
    }),
  });
}

async function runAfterCallbacks() {
  for (const [callback] of mocks.after.mock.calls) {
    await callback();
  }
}

describe("POST /api/pireps Discord notification", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mocks.requireCrewAuth.mockResolvedValue({
      ok: true,
      token: "token",
      user: { id: 42, email: "pilot@example.com", permissions: [] },
    });
    mocks.canPilotUseAircraft.mockResolvedValue(true);
    mocks.findAircraft.mockResolvedValue({ id: 7, rankreq: 1, awardreq: null });
    mocks.findDuplicatePirep.mockResolvedValue(null);
    mocks.createPirep.mockResolvedValue({ id: 99 });
    mocks.transaction.mockImplementation(async (callback) => callback({}));
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.DISCORD_WEBHOOK;
    vi.unstubAllGlobals();
    consoleError.mockRestore();
  });

  it("keeps a saved PIREP successful when Discord is unreachable", async () => {
    process.env.DISCORD_WEBHOOK = WEBHOOK_URL;
    const fetchMock = vi.fn().mockRejectedValue(new Error("Discord is down"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(pirepRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pirep).toEqual({ id: 99 });
    expect(mocks.createPirep).toHaveBeenCalledWith(
      expect.objectContaining({
        pilotid: 42,
        departure: "ZGGG",
        arrival: "ZBAA",
        flighttime: 3 * 3600 + 5 * 60,
      }),
      expect.anything(),
    );
    // The webhook waits until the response has been sent.
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    await expect(runAfterCallbacks()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      WEBHOOK_URL,
      expect.objectContaining({ method: "POST" }),
    );
    expect(consoleError).toHaveBeenCalledWith(
      "[PIREP] Discord webhook failed:",
      expect.any(Error),
    );
  });

  it("logs a webhook the Discord API rejects", async () => {
    process.env.DISCORD_WEBHOOK = WEBHOOK_URL;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 400 })),
    );

    const response = await POST(pirepRequest());
    expect(response.status).toBe(200);

    await runAfterCallbacks();
    expect(consoleError).toHaveBeenCalledWith(
      "[PIREP] Discord webhook returned HTTP 400",
    );
  });

  it("schedules nothing when no webhook is configured", async () => {
    const response = await POST(pirepRequest());

    expect(response.status).toBe(200);
    expect(mocks.after).not.toHaveBeenCalled();
  });
});
