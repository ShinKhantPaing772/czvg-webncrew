import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ crewAuth: vi.fn(), grant: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ requireCrewAuth: mocks.crewAuth }));
vi.mock("@/lib/models", () => ({ models: { AwardGranted: { findOne: mocks.grant } } }));
vi.mock("@/lib/scheduling/models", () => ({ LiveAircraft: {}, IfLiveConnection: {} }));
vi.mock("@/lib/scheduling/infinite-flight/connection", () => ({ getIfAuthorizationSnapshot: vi.fn() }));
vi.mock("@/lib/scheduling/infinite-flight/aircraft-schedules", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/scheduling/infinite-flight/aircraft-schedules")>(), loadIfAircraftSchedules: mocks.load,
}));

import { IfLiveError } from "@/lib/scheduling/infinite-flight/config";
import { GET, maxDuration } from "./route";

const data = { schedules: [], loadedAt: "2026-10-04T10:00:00.000Z", expiresAt: "2026-10-04T10:01:00.000Z", publishingReady: false, publishingDisabledReasons: [] };
function request(query = "?aircraftId=7") { return new Request("https://example.com/api/scheduling/if/schedules" + query); }
beforeEach(() => {
  vi.stubEnv("LIVE_PILOT_AWARD_ID", "7"); vi.resetAllMocks();
  mocks.crewAuth.mockResolvedValue({ ok: true, user: { id: 42, permissions: [] } });
  mocks.grant.mockResolvedValue({ id: 1 }); mocks.load.mockResolvedValue(data);
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("pilot IF schedule reads", () => {
  it.each([401, 403])("returns crew authentication denial %i without reading IF", async status => {
    const response = Response.json({ success: false, error: "Denied" }, { status });
    mocks.crewAuth.mockResolvedValue({ ok: false, response });
    expect(await GET(request())).toBe(response); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.grant).not.toHaveBeenCalled(); expect(mocks.load).not.toHaveBeenCalled();
  });

  it("requires the live award even for an administrator using the pilot route", async () => {
    mocks.crewAuth.mockResolvedValue({ ok: true, user: { id: 42, permissions: ["admin"] } }); mocks.grant.mockResolvedValue(null);
    const response = await GET(request()); expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "Live scheduling access requires the Live Pilot award" });
    expect(response.headers.get("Cache-Control")).toBe("no-store"); expect(mocks.load).not.toHaveBeenCalled();
  });

  it("reads schedules for an eligible pilot with the guarded local aircraft ID", async () => {
    const input = request(); const response = await GET(input);
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ success: true, data });
    expect(mocks.crewAuth).toHaveBeenCalledWith(input);
    expect(mocks.grant).toHaveBeenCalledWith({ where: { pilotid: 42, awardid: 7 }, attributes: ["id"] });
    expect(mocks.load).toHaveBeenCalledWith(7); expect(maxDuration).toBe(30);
  });

  it.each(["", "?aircraftId=0", "?aircraftId=1.5", "?aircraftId=7&aircraftId=8", "?aircraftId=7&organizationId=foreign"])("rejects invalid or caller-selected remote context: %s", async query => {
    const response = await GET(request(query)); expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store"); expect(mocks.load).not.toHaveBeenCalled();
  });

  it("preserves a safe domain failure and sanitizes unexpected failures", async () => {
    mocks.load.mockRejectedValueOnce(new IfLiveError("Aircraft link changed; refresh", "connection_changed", 409));
    const conflict = await GET(request()); expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({ success: false, error: "Aircraft link changed; refresh", code: "connection_changed" });
    mocks.load.mockRejectedValueOnce(new Error("private-provider-token"));
    const failure = await GET(request()); expect(failure.status).toBe(503);
    expect(failure.headers.get("Cache-Control")).toBe("no-store"); expect(await failure.text()).not.toContain("private-provider-token");
  });
});
