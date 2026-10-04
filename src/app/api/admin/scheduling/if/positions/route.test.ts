import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), load: vi.fn(), parse: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ requirePermission: mocks.authorize }));
vi.mock("@/lib/models", () => ({ models: {} }));
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

const data = { aircraft: [{ id: 7, position: null, nearbyAirport: null, error: "IF position is unavailable", code: "position_unavailable" }],
  loadedAt: "2026-10-04T10:00:00.000Z", expiresAt: "2026-10-04T10:01:00.000Z" };
function request(query = "?aircraftIds=7") { return new Request("https://example.com/api/admin/scheduling/if/positions" + query); }
beforeEach(() => { vi.resetAllMocks(); mocks.authorize.mockResolvedValue({ ok: true, user: { id: 42 } }); mocks.load.mockResolvedValue(data); });

describe("admin IF position reads", () => {
  it.each([401, 403])("checks scheduling permission before parsing or loading: HTTP %i", async status => {
    const denied = Response.json({ success: false, error: "Denied" }, { status }); mocks.authorize.mockResolvedValue({ ok: false, response: denied });
    const input = request("?ifAircraftId=foreign"); expect(await GET(input)).toBe(denied);
    expect(mocks.authorize).toHaveBeenCalledWith(input, "scheduling"); expect(mocks.parse).not.toHaveBeenCalled(); expect(mocks.load).not.toHaveBeenCalled();
    expect(denied.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns per-aircraft failures with HTTP200 and no response caching", async () => {
    const input = request(); const response = await GET(input); expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data });
    expect(mocks.authorize).toHaveBeenCalledWith(input, "scheduling"); expect(mocks.load).toHaveBeenCalledWith([7]);
    expect(response.headers.get("Cache-Control")).toBe("no-store"); expect(dynamic).toBe("force-dynamic"); expect(runtime).toBe("nodejs"); expect(maxDuration).toBe(30);
  });

  it("accepts a bounded batch and preserves safe position, nearby airport, and warning fields", async () => {
    const partial = { ...data, aircraft: [
      { id: 7, position: { latitude: 43.6777, longitude: -79.6248 }, nearbyAirport: { icao: "CYYZ", distanceNm: 0.2 } },
      { id: 8, position: null, nearbyAirport: null, error: "Infinite Flight rate limit reached", code: "rate_limited", retryAfterSeconds: 60 },
    ], airportLookupError: "Nearby airport lookup is unavailable" };
    mocks.load.mockResolvedValue(partial); const response = await GET(request("?aircraftIds=7,8")); expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: partial }); expect(mocks.load).toHaveBeenCalledWith([7, 8]);
    expect(response.headers.get("Retry-After")).toBeNull();
  });

  it.each(["", "?aircraftIds=", "?aircraftIds=-1", "?aircraftIds=1.5", "?aircraftIds=1e2", "?aircraftIds=2147483648", "?aircraftIds=7,7",
    "?aircraftIds=1,2,3,4,5,6,7", "?aircraftIds=7&aircraftIds=7", "?aircraftIds=7&aircraftIds=8", "?aircraftIds=7&organizationId=foreign",
    "?aircraftIds=7&fresh=true", "?aircraftIds=10000000-0000-0000-0000-000000000001"])("rejects invalid or caller-selected remote context: %s", async query => {
    const response = await GET(request(query)); expect(response.status).toBe(400);
    expect(mocks.load).not.toHaveBeenCalled(); expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("preserves global provider errors and rate-limit retry headers", async () => {
    mocks.load.mockRejectedValueOnce(new IfLiveError("IF denied this operation", "forbidden", 403));
    const denied = await GET(request()); expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toEqual({ success: false, error: "IF denied this operation", code: "forbidden" });
    mocks.load.mockRejectedValueOnce(new IfLiveError("Infinite Flight rate limit reached", "rate_limited", 429, 120));
    const limited = await GET(request()); expect(limited.status).toBe(429); expect(limited.headers.get("Retry-After")).toBe("120");
    expect(limited.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each(["authorization", "helper"])("sanitizes an unexpected %s failure", async source => {
    (source === "authorization" ? mocks.authorize : mocks.load).mockRejectedValue(new Error("private-db-or-provider-details"));
    const response = await GET(request()); expect(response.status).toBe(503); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).not.toContain("private-db-or-provider-details");
    if (source === "authorization") { expect(mocks.parse).not.toHaveBeenCalled(); expect(mocks.load).not.toHaveBeenCalled(); }
  });
});
