import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), match: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ requirePermission: mocks.authorize }));
vi.mock("@/lib/scheduling/infinite-flight/schedule-match", () => ({ matchIfAircraftSchedule: mocks.match }));
import { POST, maxDuration } from "./route";
import { IfLiveError } from "@/lib/scheduling/infinite-flight/config";

const body = { flightId: 23, scheduleId: "10000000-0000-0000-0000-000000000001", expectedFingerprint: "a".repeat(64), expectedRevision: 4 };
const request = (content = JSON.stringify(body), query = "") => new Request("https://example.com/api/admin/scheduling/if/match" + query,
  { method: "POST", headers: { "Content-Type": "application/json" }, body: content });
beforeEach(() => { vi.resetAllMocks(); mocks.authorize.mockResolvedValue({ ok: true, user: { id: 42 } }); mocks.match.mockResolvedValue({ flightId: 23 }); });
describe("administrator IF same-flight matching route", () => {
  it.each([401, 403])("preserves permission denial %i without matching", async status => {
    const response = Response.json({ success: false }, { status }); mocks.authorize.mockResolvedValue({ ok: false, response });
    const input = request(); expect(await POST(input)).toBe(response); expect(mocks.authorize).toHaveBeenCalledWith(input, "scheduling");
    expect(mocks.match).not.toHaveBeenCalled(); expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("derives the administrator from authentication and returns only the local flight ID", async () => {
    const input = request(); const response = await POST(input); expect(response.status).toBe(200);
    expect(mocks.authorize).toHaveBeenCalledWith(input, "scheduling"); expect(mocks.match).toHaveBeenCalledWith(42, body);
    await expect(response.json()).resolves.toEqual({ success: true, data: { flightId: 23 } }); expect(response.headers.get("Cache-Control")).toBe("no-store"); expect(maxDuration).toBe(30);
  });
  it("rejects malformed JSON and query overrides", async () => {
    expect((await POST(request("{"))).status).toBe(400); expect((await POST(request(JSON.stringify(body), "?flightId=24"))).status).toBe(400); expect(mocks.match).not.toHaveBeenCalled();
  });
  it("reports stale schedule conflicts without exposing private provider responses", async () => {
    mocks.match.mockRejectedValue(new IfLiveError("Refresh before matching", "conflict", 409)); const response = await POST(request());
    expect(response.status).toBe(409); await expect(response.json()).resolves.toEqual({ success: false, error: "Refresh before matching", code: "conflict" });
    mocks.match.mockRejectedValue(new Error("private-provider-token")); const failure = await POST(request()); expect(failure.status).toBe(503); expect(await failure.text()).not.toContain("private-provider-token");
  });
});
