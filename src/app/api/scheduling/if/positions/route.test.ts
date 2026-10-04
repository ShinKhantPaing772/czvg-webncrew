import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ crewAuth: vi.fn(), grant: vi.fn(), load: vi.fn(), parse: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ requireCrewAuth: mocks.crewAuth }));
vi.mock("@/lib/models", () => ({ models: { AwardGranted: { findOne: mocks.grant } } }));
vi.mock("@/lib/scheduling/models", () => ({ LiveAircraft: {}, IfLiveConnection: {} }));
vi.mock("@/lib/scheduling/infinite-flight/connection", () => ({ getIfAuthorizationSnapshot: vi.fn() }));
vi.mock("@/lib/scheduling/infinite-flight/aircraft-positions", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/scheduling/infinite-flight/aircraft-positions")>();
  return { ...actual, loadIfAircraftPositions: mocks.load, localAircraftIdsFromRequest: (request: Request) => {
    mocks.parse(request); return actual.localAircraftIdsFromRequest(request);
  } };
});

import { IfLiveError } from "@/lib/scheduling/infinite-flight/config";
import { GET, dynamic, maxDuration, runtime } from "./route";

const data = {
  aircraft: [{ id: 7, position: { latitude: 43.6777, longitude: -79.6248, isOnGround: true, updatedAt: "2026-10-04T10:00:00.000Z" }, nearbyAirport: { icao: "CYYZ", distanceNm: 0.2 } }],
  loadedAt: "2026-10-04T10:00:00.000Z", expiresAt: "2026-10-04T10:01:00.000Z",
};
function request(query = "?aircraftIds=7") { return new Request("https://example.com/api/scheduling/if/positions" + query); }
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("LIVE_PILOT_AWARD_ID", "7");
  mocks.crewAuth.mockResolvedValue({ ok: true, user: { id: 42, permissions: [] } }); mocks.grant.mockResolvedValue({ id: 1 }); mocks.load.mockResolvedValue(data);
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("pilot IF position reads", () => {
  it.each([401, 403])("authorizes before parsing or requesting positions: HTTP %i", async status => {
    const denied = Response.json({ success: false, error: "Denied" }, { status }); mocks.crewAuth.mockResolvedValue({ ok: false, response: denied });
    const input = request("?remoteId=private"); expect(await GET(input)).toBe(denied);
    expect(mocks.crewAuth).toHaveBeenCalledWith(input); expect(mocks.parse).not.toHaveBeenCalled();
    expect(mocks.grant).not.toHaveBeenCalled(); expect(mocks.load).not.toHaveBeenCalled(); expect(denied.headers.get("Cache-Control")).toBe("no-store");
  });

  it("requires the Live Pilot award even for an administrator on the pilot route", async () => {
    mocks.crewAuth.mockResolvedValue({ ok: true, user: { id: 42, permissions: ["admin"] } }); mocks.grant.mockResolvedValue(null);
    const response = await GET(request()); expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "Live scheduling access requires the Live Pilot award" });
    expect(mocks.parse).not.toHaveBeenCalled(); expect(mocks.load).not.toHaveBeenCalled(); expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("propagates the safe temporary position and airport response for eligible pilots", async () => {
    const input = request(); const response = await GET(input); expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data });
    expect(mocks.load).toHaveBeenCalledWith([7]); expect(mocks.grant).toHaveBeenCalledWith({ where: { pilotid: 42, awardid: 7 }, attributes: ["id"] });
    expect(mocks.parse.mock.invocationCallOrder[0]).toBeLessThan(mocks.load.mock.invocationCallOrder[0]);
    expect(response.headers.get("Cache-Control")).toBe("no-store"); expect(dynamic).toBe("force-dynamic"); expect(runtime).toBe("nodejs"); expect(maxDuration).toBe(30);
  });

  it("accepts six unique local signed-INT IDs without changing their order", async () => {
    const response = await GET(request("?aircraftIds=7,2,3,4,5,2147483647")); expect(response.status).toBe(200);
    expect(mocks.load).toHaveBeenCalledWith([7, 2, 3, 4, 5, 2_147_483_647]);
  });

  it.each(["", "?aircraftIds=", "?aircraftIds=0", "?aircraftIds=-1", "?aircraftIds=1.5", "?aircraftIds=1e2", "?aircraftIds=2147483648",
    "?aircraftIds=7,7", "?aircraftIds=7,", "?aircraftIds=1,2,3,4,5,6,7", "?aircraftIds=7&aircraftIds=8", "?aircraftIds=7&aircraftIds=7",
    "?aircraftIds=7&organizationId=foreign", "?aircraftIds=10000000-0000-0000-0000-000000000001"])("rejects invalid batches before loading positions: %s", async query => {
    const response = await GET(request(query)); expect(response.status).toBe(400);
    expect(mocks.load).not.toHaveBeenCalled(); expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps partial position failures and airport lookup warnings in a successful batch", async () => {
    const partial = { ...data, aircraft: [...data.aircraft, { id: 8, position: null, nearbyAirport: null, error: "IF position is unavailable", code: "position_unavailable", retryAfterSeconds: 60 }], airportLookupError: "Nearby airport lookup is unavailable" };
    mocks.load.mockResolvedValue(partial); const response = await GET(request("?aircraftIds=7,8")); expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: partial }); expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("preserves global provider rate limits and their retry interval", async () => {
    mocks.load.mockRejectedValue(new IfLiveError("Infinite Flight rate limit reached", "rate_limited", 429, 120));
    const response = await GET(request()); expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("120");
    expect(response.headers.get("Cache-Control")).toBe("no-store"); await expect(response.json()).resolves.toEqual({ success: false, error: "Infinite Flight rate limit reached", code: "rate_limited" });
  });

  it.each(["authorization", "helper"])("sanitizes an unexpected %s failure", async source => {
    (source === "authorization" ? mocks.crewAuth : mocks.load).mockRejectedValue(new Error("private-token-or-query"));
    const response = await GET(request()); expect(response.status).toBe(503); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).not.toContain("private-token-or-query");
    if (source === "authorization") { expect(mocks.parse).not.toHaveBeenCalled(); expect(mocks.load).not.toHaveBeenCalled(); }
  });
});
