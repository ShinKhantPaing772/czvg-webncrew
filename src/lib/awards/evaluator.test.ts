import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateCriteria, AwardCriteria } from "./evaluator";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findPilot: vi.fn(),
  findPireps: vi.fn(),
  findGrants: vi.fn(),
  findAwards: vi.fn(),
  bulkCreateGrants: vi.fn(),
  bulkCreateNotifications: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  default: {
    transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/models", () => ({
  models: {
    Pilot: { findByPk: mocks.findPilot },
    Pirep: { findAll: mocks.findPireps },
    AwardGranted: {
      findAll: mocks.findGrants,
      bulkCreate: mocks.bulkCreateGrants,
    },
    Award: { findAll: mocks.findAwards },
    Notification: { bulkCreate: mocks.bulkCreateNotifications },
  },
}));

import { evaluateAndGrantAwards, getPilotBadgesOverview } from "./evaluator";

describe("evaluateCriteria", () => {
  const dummyStats = {
    totalSeconds: 36000, // 10 hours
    totalHours: 10,
    totalFlights: 4,
    maxSingleDurationHours: 4.5,
    airportCounts: new Map([
      ["ZGGG", 3],
      ["ZBAD", 2],
      ["KLAX", 1],
    ]),
    routeCounts: new Map([
      ["ZGGG-ZBAD", 2],
      ["ZBAD-ZGGG", 2],
    ]),
    aircraftCounts: new Map([
      ["AIRBUS A350-900", 2],
      ["BOEING 777-300ER", 1],
    ]),
    nightFlights: 1,
    membershipDays: 100,
  };

  it("evaluates hours criteria correctly", () => {
    const meetHours: AwardCriteria = { type: "hours", threshold: 10 };
    const failHours: AwardCriteria = { type: "hours", threshold: 50 };

    expect(evaluateCriteria(meetHours, dummyStats).meets).toBe(true);
    expect(evaluateCriteria(meetHours, dummyStats).progress.percentage).toBe(100);

    expect(evaluateCriteria(failHours, dummyStats).meets).toBe(false);
    expect(evaluateCriteria(failHours, dummyStats).progress.percentage).toBe(20);
  });

  it("evaluates flights criteria correctly", () => {
    const meetFlights: AwardCriteria = { type: "flights", threshold: 4 };
    const failFlights: AwardCriteria = { type: "flights", threshold: 10 };

    expect(evaluateCriteria(meetFlights, dummyStats).meets).toBe(true);
    expect(evaluateCriteria(failFlights, dummyStats).meets).toBe(false);
  });

  it("evaluates airport criteria correctly", () => {
    const meetAirport: AwardCriteria = { type: "airport", icao: "ZGGG", count: 3 };
    const failAirport: AwardCriteria = { type: "airport", icao: "ZGGG", count: 5 };
    const nonExistent: AwardCriteria = { type: "airport", icao: "ZGSZ", count: 1 };

    expect(evaluateCriteria(meetAirport, dummyStats).meets).toBe(true);
    expect(evaluateCriteria(failAirport, dummyStats).meets).toBe(false);
    expect(evaluateCriteria(nonExistent, dummyStats).meets).toBe(false);
  });

  it("evaluates aircraft criteria regex match correctly", () => {
    const meetA350: AwardCriteria = { type: "aircraft", match: "A350", count: 2 };
    const failA350: AwardCriteria = { type: "aircraft", match: "A350", count: 3 };
    const meetB777: AwardCriteria = { type: "aircraft", match: "777", count: 1 };

    expect(evaluateCriteria(meetA350, dummyStats).meets).toBe(true);
    expect(evaluateCriteria(failA350, dummyStats).meets).toBe(false);
    expect(evaluateCriteria(meetB777, dummyStats).meets).toBe(true);
  });

  it("evaluates route criteria correctly", () => {
    const meetRoute: AwardCriteria = {
      type: "route",
      airports: ["ZGGG", "ZBAD"],
      count: 2,
    };
    const failRoute: AwardCriteria = {
      type: "route",
      airports: ["ZGGG", "ZBAD"],
      count: 5,
    };

    expect(evaluateCriteria(meetRoute, dummyStats).meets).toBe(true);
    expect(evaluateCriteria(failRoute, dummyStats).meets).toBe(false);
  });

  it("evaluates single duration hours criteria correctly", () => {
    const meetSingle: AwardCriteria = {
      type: "single_duration_hours",
      threshold: 4,
    };
    const failSingle: AwardCriteria = {
      type: "single_duration_hours",
      threshold: 10,
    };

    expect(evaluateCriteria(meetSingle, dummyStats).meets).toBe(true);
    expect(evaluateCriteria(failSingle, dummyStats).meets).toBe(false);
  });

  it("evaluates airports_multi and clean_streak correctly", () => {
    const meetMulti: AwardCriteria = {
      type: "airports_multi",
      airports: ["ZGGG", "ZBAD"],
      count: 5,
    };
    const failMulti: AwardCriteria = {
      type: "airports_multi",
      airports: ["ZGGG", "ZBAD"],
      count: 10,
    };

    expect(evaluateCriteria(meetMulti, dummyStats).meets).toBe(true);
    expect(evaluateCriteria(failMulti, dummyStats).meets).toBe(false);

    const meetClean: AwardCriteria = { type: "clean_streak", count: 4 };
    const failClean: AwardCriteria = { type: "clean_streak", count: 20 };
    expect(evaluateCriteria(meetClean, dummyStats).meets).toBe(true);
    expect(evaluateCriteria(failClean, dummyStats).meets).toBe(false);
  });
});

describe("evaluateAndGrantAwards", () => {
  const transactionObj = {};

  beforeEach(() => {
    mocks.transaction.mockReset().mockImplementation((cb) => cb(transactionObj));
    mocks.findPilot.mockReset().mockResolvedValue({
      id: 10,
      callsign: "CSN10",
      name: "Pilot Ten",
    });
    mocks.findPireps.mockReset().mockResolvedValue([
      {
        id: 1,
        departure: "ZGGG",
        arrival: "ZBAD",
        flighttime: 7200,
        date: "2026-05-01T10:00:00Z",
        Aircraft: { id: 1, name: "Airbus A350-900" },
      },
    ]);
    mocks.findGrants.mockReset().mockResolvedValue([]);
    mocks.findAwards.mockReset().mockResolvedValue([
      {
        id: 101,
        name: "First Wings",
        category: "milestone",
        criteria: { type: "flights", threshold: 1 },
      },
      {
        id: 102,
        name: "Century Aviator",
        category: "milestone",
        criteria: { type: "flights", threshold: 100 },
      },
    ]);
    mocks.bulkCreateGrants.mockReset().mockResolvedValue([]);
    mocks.bulkCreateNotifications.mockReset().mockResolvedValue([]);
  });

  it("grants newly met awards and records grants", async () => {
    const result = await evaluateAndGrantAwards(10);

    expect(result.grantedAwards).toHaveLength(1);
    expect(result.grantedAwards[0].id).toBe(101);
    expect(mocks.bulkCreateGrants).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ awardid: 101, pilotid: 10 }),
      ]),
      expect.any(Object),
    );
  });

  it("skips previously granted awards", async () => {
    mocks.findGrants.mockResolvedValue([{ awardid: 101 }]);

    const result = await evaluateAndGrantAwards(10);

    expect(result.grantedAwards).toHaveLength(0);
    expect(mocks.bulkCreateGrants).not.toHaveBeenCalled();
  });
});

describe("getPilotBadgesOverview", () => {
  beforeEach(() => {
    mocks.findPilot.mockReset().mockResolvedValue({ id: 10 });
    mocks.findPireps.mockReset().mockResolvedValue([
      {
        id: 1,
        departure: "ZGGG",
        arrival: "ZBAD",
        flighttime: 7200, // 2 hours
        date: "2026-05-01T10:00:00Z",
        Aircraft: { id: 1, name: "Airbus A350-900" },
      },
    ]);
    mocks.findGrants.mockReset().mockResolvedValue([
      { awardid: 1, dateawarded: "2026-05-01" },
    ]);
    mocks.findAwards.mockReset().mockResolvedValue([
      {
        id: 1,
        name: "First Wings",
        category: "milestone",
        criteria: { type: "flights", threshold: 1 },
      },
      {
        id: 2,
        name: "Wings of Bronze",
        category: "milestone",
        criteria: { type: "hours", threshold: 5 },
      },
    ]);
  });

  it("returns overview with unlocked status and accurate progress for unearned badges", async () => {
    const overview = await getPilotBadgesOverview(10);

    expect(overview.totalAvailable).toBe(2);
    expect(overview.totalUnlocked).toBe(1);
    expect(overview.unlockPercentage).toBe(50);

    const firstBadge = overview.badges.find((b) => b.id === 1);
    expect(firstBadge?.isUnlocked).toBe(true);

    const secondBadge = overview.badges.find((b) => b.id === 2);
    expect(secondBadge?.isUnlocked).toBe(false);
    expect(secondBadge?.progress?.current).toBe(2);
    expect(secondBadge?.progress?.target).toBe(5);
    expect(secondBadge?.progress?.percentage).toBe(40);
  });
});
