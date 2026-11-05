import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sumPireps: vi.fn(),
  findPilot: vi.fn(),
  findRank: vi.fn(),
  findGrant: vi.fn(),
}));

vi.mock("@/lib/models", () => ({
  models: {
    Pirep: { sum: mocks.sumPireps },
    Pilot: { findByPk: mocks.findPilot },
    Rank: { findByPk: mocks.findRank },
    AwardGranted: { findOne: mocks.findGrant },
  },
}));

import { getPilotRankTime, transferTimeSeconds } from "./pilot-flight-time";
import { canPilotUseAircraft } from "./aircraft-eligibility";

const HOUR = 3600;

describe("transferTimeSeconds", () => {
  it.each([
    [50 * HOUR, 50 * HOUR],
    ["3600", HOUR],
    [0, 0],
    [null, 0],
    [-5, 0],
    ["not a number", 0],
  ])("reads %j stored seconds as %i seconds", (stored, seconds) => {
    expect(transferTimeSeconds(stored)).toBe(seconds);
  });
});

describe("getPilotRankTime", () => {
  it("adds transfer time (stored in seconds) to approved PIREP time", async () => {
    mocks.sumPireps.mockResolvedValue(10 * HOUR);
    mocks.findPilot.mockResolvedValue({ transhours: 50 * HOUR });

    await expect(getPilotRankTime(42)).resolves.toEqual({
      approvedSeconds: 10 * HOUR,
      transferSeconds: 50 * HOUR,
      rankSeconds: 60 * HOUR,
    });
  });

  it("treats a pilot with no PIREPs or transfer time as zero", async () => {
    mocks.sumPireps.mockResolvedValue(null);
    mocks.findPilot.mockResolvedValue({ transhours: 0 });

    await expect(getPilotRankTime(42)).resolves.toMatchObject({
      rankSeconds: 0,
    });
  });
});

describe("canPilotUseAircraft with transfer time", () => {
  beforeEach(() => {
    // The aircraft needs a rank that takes 40 hours.
    mocks.findRank.mockResolvedValue({ timereq: 40 * HOUR });
    mocks.findGrant.mockResolvedValue(null);
    mocks.sumPireps.mockResolvedValue(10 * HOUR);
  });

  it("unlocks the aircraft once transfer time covers the gap", async () => {
    mocks.findPilot.mockResolvedValue({ transhours: 30 * HOUR });

    await expect(canPilotUseAircraft(42, { rankreq: 3 })).resolves.toBe(true);
  });

  it("keeps it locked when the combined time is still short", async () => {
    mocks.findPilot.mockResolvedValue({ transhours: 29 * HOUR });

    await expect(canPilotUseAircraft(42, { rankreq: 3 })).resolves.toBe(false);
  });
});
