import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ requirePermission: mocks.authorize }));
vi.mock("@/lib/scheduling/models", () => ({ LiveAircraft: {}, IfLiveConnection: {} }));
vi.mock("@/lib/scheduling/infinite-flight/connection", () => ({ getIfAuthorizationSnapshot: vi.fn() }));
vi.mock("@/lib/scheduling/infinite-flight/aircraft-schedules", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/scheduling/infinite-flight/aircraft-schedules")>(), loadIfAircraftSchedules: mocks.load,
}));

import { IfLiveError } from "@/lib/scheduling/infinite-flight/config";
import { GET, maxDuration } from "./route";

const data = { schedules: [], loadedAt: "2026-10-04T10:00:00.000Z", expiresAt: "2026-10-04T10:01:00.000Z", publishingReady: false, publishingDisabledReasons: [] };
function request(query = "?aircraftId=7") { return new Request("https://example.com/api/admin/scheduling/if/schedules" + query); }
beforeEach(() => {
  vi.resetAllMocks(); mocks.authorize.mockResolvedValue({ ok: true, user: { id: 42 } }); mocks.load.mockResolvedValue(data);
});

describe("admin IF schedule reads", () => {
  it.each([401, 403])("preserves permission denial %i and does not read schedules", async status => {
    const response = Response.json({ success: false, error: "Denied" }, { status }); mocks.authorize.mockResolvedValue({ ok: false, response });
    const input = request(); expect(await GET(input)).toBe(response);
    expect(mocks.authorize).toHaveBeenCalledWith(input, "scheduling"); expect(mocks.load).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("requires scheduling permission and returns the safe temporary response", async () => {
    const input = request(); const response = await GET(input); expect(response.status).toBe(200);
    expect(mocks.authorize).toHaveBeenCalledWith(input, "scheduling"); expect(mocks.load).toHaveBeenCalledWith(7);
    await expect(response.json()).resolves.toEqual({ success: true, data });
    expect(response.headers.get("Cache-Control")).toBe("no-store"); expect(maxDuration).toBe(30);
  });

  it.each(["", "?aircraftId=-1", "?aircraftId=1e2", "?aircraftId=7&aircraftId=8", "?aircraftId=7&aircraftId=7", "?aircraftId=7&if_aircraft_id=foreign"])("rejects invalid queries before reading: %s", async query => {
    const response = await GET(request(query)); expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store"); expect(mocks.load).not.toHaveBeenCalled();
  });

  it("preserves an IF failure without provider error details", async () => {
    mocks.load.mockRejectedValueOnce(new IfLiveError("Infinite Flight rate limit reached", "rate_limited", 429, 120));
    const limited = await GET(request()); expect(limited.status).toBe(429); expect(limited.headers.get("Retry-After")).toBe("120");
    mocks.load.mockRejectedValueOnce(new Error("private-query-secret"));
    const failure = await GET(request()); expect(failure.status).toBe(503);
    expect(failure.headers.get("Cache-Control")).toBe("no-store"); expect(await failure.text()).not.toContain("private-query-secret");
  });
});
