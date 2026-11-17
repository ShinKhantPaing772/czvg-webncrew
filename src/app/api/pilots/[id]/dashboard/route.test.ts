import { beforeEach, describe, expect, it, vi } from "vitest";
import { col, fn } from "sequelize";

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

describe("GET /api/pilots/[id]/dashboard", () => {
  beforeEach(() => {
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
  });

  it("counts transfer hours toward rank, unlocks and total time", async () => {
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
    expect(body.topAircraft).toEqual([]);
  });

  it("uses whole-history aircraft totals independently of the latest ten sectors", async () => {
    const recentPireps = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      flightnum: `CZ${index + 1}`,
      date: "2026-11-17",
      departure: "ZGGG",
      arrival: "ZPPP",
      flighttime: HOUR,
      status: index === 0 ? 2 : 1,
      Aircraft: { id: 1, name: "Boeing 737-8 MAX", liveryname: "China Southern" },
    }));
    mocks.findPireps.mockImplementation(async (options) =>
      options.group
        ? [
            { label: "Airbus A380", value: "31" },
            { label: "Boeing 737-8 MAX", value: "10" },
            { label: "Unknown", value: "2" },
          ]
        : recentPireps,
    );

    const response = await GET(
      new Request("http://localhost/api/pilots/42/dashboard"),
      { params: Promise.resolve({ id: "42" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.topAircraft).toEqual([
      { label: "Airbus A380", value: 31 },
      { label: "Boeing 737-8 MAX", value: 10 },
      { label: "Unknown", value: 2 },
    ]);
    expect(body.recentPireps).toHaveLength(10);
    expect(body.statistics.recentRejectedPireps).toBe(1);
    expect(body.statistics.recentPirepWarningLimit).toBe(10);

    // Aggregate the pilot's complete history by aircraft name, including
    // missing aircraft and multiple liveries of the same aircraft type.
    const aggregateQuery = mocks.findPireps.mock.calls.find(
      ([options]) => options.group,
    )?.[0];
    const aircraftName = fn(
      "COALESCE",
      fn("NULLIF", col("Aircraft.name"), ""),
      "Unknown",
    );
    const aircraftFlights = fn("COUNT", col("Pirep.id"));
    expect(aggregateQuery.where).toEqual({ pilotid: 42 });
    expect(aggregateQuery.attributes).toEqual([
      [aircraftName, "label"],
      [aircraftFlights, "value"],
    ]);
    expect(aggregateQuery.group).toEqual([aircraftName]);
    expect(aggregateQuery.include).toEqual([
      expect.objectContaining({ as: "Aircraft", attributes: [], required: false }),
    ]);
    expect(aggregateQuery.order).toEqual([
      [aircraftFlights, "DESC"],
      [aircraftName, "ASC"],
    ]);
    expect(aggregateQuery.limit).toBe(4);
  });
});
