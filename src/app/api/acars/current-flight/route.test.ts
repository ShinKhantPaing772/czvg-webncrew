import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireCrewAuth: vi.fn(),
  findPilot: vi.fn(),
  findAircraft: vi.fn(),
  findCurrentFlight: vi.fn(),
  findRecentCompletedInfiniteFlight: vi.fn(),
  findInfiniteFlightInUserLogbook: vi.fn(),
  resolveInfiniteFlightUserId: vi.fn(),
  getInfiniteFlightFlightPlan: vi.fn(),
  getInfiniteFlightUserFlight: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({
  requireCrewAuth: mocks.requireCrewAuth,
  hasPermission: () => true,
}));

vi.mock("@/lib/models", () => ({
  models: {
    Pilot: { findByPk: mocks.findPilot },
    Aircraft: { findAll: mocks.findAircraft },
  },
}));

vi.mock("@/lib/acars/current-flight", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/acars/current-flight")>();
  return {
    ...actual,
    findCurrentFlight: mocks.findCurrentFlight,
    findRecentCompletedInfiniteFlight: mocks.findRecentCompletedInfiniteFlight,
    findInfiniteFlightInUserLogbook: mocks.findInfiniteFlightInUserLogbook,
    resolveInfiniteFlightUserId: mocks.resolveInfiniteFlightUserId,
  };
});

vi.mock("@/lib/infinite-flight-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/infinite-flight-api")>();
  return {
    ...actual,
    getInfiniteFlightFlightPlan: mocks.getInfiniteFlightFlightPlan,
    getInfiniteFlightUserFlight: mocks.getInfiniteFlightUserFlight,
  };
});

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireCrewAuth.mockResolvedValue({
    ok: true,
    user: { id: 1, permissions: [] },
  });
  mocks.findPilot.mockResolvedValue({
    id: 1,
    ifc: "TestPilot",
    ifuserid: "11111111-1111-1111-1111-111111111111",
  });
  mocks.findAircraft.mockResolvedValue([
    {
      id: "10",
      ifaircraftid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      ifliveryid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    },
  ]);
  mocks.resolveInfiniteFlightUserId.mockResolvedValue(
    "11111111-1111-1111-1111-111111111111",
  );
  mocks.findCurrentFlight.mockResolvedValue(null);
  mocks.findRecentCompletedInfiniteFlight.mockResolvedValue(null);
  mocks.findInfiniteFlightInUserLogbook.mockResolvedValue(null);
  mocks.getInfiniteFlightFlightPlan.mockResolvedValue({
    data: { errorCode: 0, result: {} },
    cacheStatus: "MISS",
  });
  mocks.getInfiniteFlightUserFlight.mockResolvedValue({
    data: { errorCode: 0, result: {} },
    cacheStatus: "MISS",
  });
});

describe("GET /api/acars/current-flight", () => {
  it("returns 400 when pilotId is missing", async () => {
    const request = new NextRequest(
      "http://localhost/api/acars/current-flight",
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Pilot ID is required");
  });

  it("returns recent completed flight with rounded fuel and official time", async () => {
    const recent = {
      id: "22222222-2222-2222-2222-222222222222",
      flightNumber: "CSN301",
      originAirport: "ZGGG",
      destinationAirport: "ZSPD",
      totalTime: 125, // 2 hours 5 mins
      fuelUsedKg: 14250.7,
      created: "2026-10-26T12:00:00Z",
      aircraftId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      liveryId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    };
    mocks.findRecentCompletedInfiniteFlight.mockResolvedValue(recent);

    const request = new NextRequest(
      "http://localhost/api/acars/current-flight?pilotId=1&refresh=true",
    );
    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.acars.flightnum).toBe("CSN301");
    expect(data.acars.departure).toBe("ZGGG");
    expect(data.acars.arrival).toBe("ZSPD");
    expect(data.acars.flightTime).toBe("02:05");
    expect(data.acars.fuelUsed).toBe("14251"); // rounded
    expect(data.meta.source).toBe("recent");
    expect(data.meta.fuelPending).toBe(false);
    expect(data.meta.flightTimeEstimated).toBe(false);
    expect(mocks.findRecentCompletedInfiniteFlight).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      true, // forceRefresh passed
    );
  });

  it("fetches single flight details when summary logbook item is missing fuel", async () => {
    const summary = {
      id: "22222222-2222-2222-2222-222222222222",
      flightNumber: "CSN302",
      originAirport: "ZGGG",
      destinationAirport: "ZBAA",
      totalTime: 180,
      fuelUsedKg: null, // missing in summary!
      created: "2026-10-26T14:00:00Z",
    };
    mocks.findRecentCompletedInfiniteFlight.mockResolvedValue(summary);
    mocks.getInfiniteFlightUserFlight.mockResolvedValue({
      data: {
        errorCode: 0,
        result: {
          id: "22222222-2222-2222-2222-222222222222",
          fuelUsedKg: 21500,
        },
      },
      cacheStatus: "MISS",
    });

    const request = new NextRequest(
      "http://localhost/api/acars/current-flight?pilotId=1",
    );
    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.acars.fuelUsed).toBe("21500");
    expect(data.meta.fuelPending).toBe(false);
    expect(mocks.getInfiniteFlightUserFlight).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      false,
    );
  });
});
