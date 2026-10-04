import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), load: vi.fn(), edit: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ requirePermission: mocks.authorize }));
vi.mock("@/lib/scheduling/infinite-flight/schedule-edit", () => ({ editIfAircraftSchedule: mocks.edit }));
vi.mock("@/lib/scheduling/models", () => ({ LiveAircraft: {}, IfLiveConnection: {} }));
vi.mock("@/lib/scheduling/infinite-flight/connection", () => ({ getIfAuthorizationSnapshot: vi.fn() }));
vi.mock("@/lib/scheduling/infinite-flight/aircraft-schedules", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/scheduling/infinite-flight/aircraft-schedules")>(), loadIfAircraftSchedules: mocks.load,
}));

import { IfLiveError } from "@/lib/scheduling/infinite-flight/config";
import { GET, PATCH, maxDuration } from "./route";

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
    expect(mocks.authorize).toHaveBeenCalledWith(input, "scheduling"); expect(mocks.load).toHaveBeenCalledWith(7, { admin: true });
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

describe("admin IF schedule writes", () => {
  const body = { aircraftId: 7, scheduleId: "10000000-0000-0000-0000-000000000001", expectedFingerprint: "a".repeat(64), changes: { callsign: "IF2" } };
  const editRequest = (content = JSON.stringify(body), query = "") => new Request("https://example.com/api/admin/scheduling/if/schedules" + query, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: content });
  it.each([401, 403])("preserves permission denial %i without editing IF", async status => {
    const response = Response.json({ success: false }, { status }); mocks.authorize.mockResolvedValue({ ok: false, response });
    const request = editRequest(); expect(await PATCH(request)).toBe(response); expect(mocks.edit).not.toHaveBeenCalled();
    expect(mocks.authorize).toHaveBeenCalledWith(request, "scheduling"); expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("derives the administrator from site authentication and returns the updated safe view", async () => {
    const updated = { schedule: { id: body.scheduleId, callsign: "IF2" } }; mocks.edit.mockResolvedValue(updated);
    const response = await PATCH(editRequest()); expect(response.status).toBe(200); expect(mocks.edit).toHaveBeenCalledWith(42, body);
    expect(response.headers.get("Cache-Control")).toBe("no-store"); await expect(response.json()).resolves.toEqual({ success: true, data: updated });
  });
  it("rejects malformed JSON and unsupported query overrides before an IF write", async () => {
    expect((await PATCH(editRequest("{"))).status).toBe(400);
    expect((await PATCH(editRequest(JSON.stringify(body), "?aircraftId=8"))).status).toBe(400); expect(mocks.edit).not.toHaveBeenCalled();
  });
  it("returns an arrived-flight lock from the service without leaking provider content", async () => {
    mocks.edit.mockRejectedValue(new IfLiveError("Arrived flights are locked", "locked", 409));
    const response = await PATCH(editRequest()); expect(response.status).toBe(409); await expect(response.json()).resolves.toEqual({ success: false, error: "Arrived flights are locked", code: "locked" });
  });
});
