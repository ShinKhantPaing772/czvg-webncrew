import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findPilot: vi.fn(),
  sumPireps: vi.fn(),
  countPireps: vi.fn(),
  findPireps: vi.fn(),
  findRanks: vi.fn(),
  findGrants: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({
  requireCrewAuth: vi.fn().mockResolvedValue({
    ok: true,
    token: "token",
    user: { id: 42, email: "pilot@example.com", permissions: [] },
  }),
  hasPermission: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/awards/evaluator", () => ({
  getPilotBadgesOverview: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/awards/columns", () => ({
  getSafeAwards: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/models", () => ({
  models: {
    Pilot: { findByPk: mocks.findPilot },
    Pirep: {
      sum: mocks.sumPireps,
      count: mocks.countPireps,
      findAll: mocks.findPireps,
    },
    Rank: { findAll: mocks.findRanks },
    AwardGranted: { findAll: mocks.findGrants },
    Aircraft: {},
  },
}));

import { GET } from "./route";

const HOUR = 3600;

describe("GET /api/pilots/[id]/dashboard transfer hours", () => {
  it("counts transfer hours toward rank, unlocks and total time", async () => {
    mocks.findPilot.mockResolvedValue({
      id: 42,
      name: "Test Pilot",
      status: 1,
      transhours: 30 * HOUR,
      transflights: 12,
    });
    mocks.sumPireps.mockResolvedValue(15 * HOUR);
    mocks.countPireps.mockResolvedValue(0);
    mocks.findPireps.mockResolvedValue([]);
    mocks.findGrants.mockResolvedValue([]);
    mocks.findRanks.mockResolvedValue([
      { id: 1, name: "Second Officer", timereq: 0 },
      { id: 2, name: "First Officer", timereq: 40 * HOUR },
      { id: 3, name: "Captain", timereq: 100 * HOUR },
    ]);

    const response = await GET(
      new Request("http://localhost/api/pilots/42/dashboard"),
      { params: Promise.resolve({ id: "42" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    // 15 approved hours alone would still be Second Officer.
    expect(body.rank.current.name).toBe("First Officer");
    expect(body.rank.eligibleRankIds).toEqual([1, 2]);
    expect(body.statistics).toMatchObject({
      approvedFlightSeconds: 15 * HOUR,
      transferFlightSeconds: 30 * HOUR,
      transferFlights: 12,
      totalFlightTime: "45:00",
    });
  });
});
