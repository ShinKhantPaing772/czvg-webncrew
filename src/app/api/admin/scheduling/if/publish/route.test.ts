import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), aircraft: vi.fn(), publish: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ requirePermission: mocks.authorize }));
vi.mock("@/lib/scheduling/models", () => ({ LiveAircraft: { findByPk: mocks.aircraft } }));
vi.mock("@/lib/scheduling/infinite-flight/publisher", () => ({ runIfLivePublisher: mocks.publish }));
import { IfLiveError } from "@/lib/scheduling/infinite-flight/config";
import { POST, maxDuration } from "./route";

const result = { processed: 1, published: 1, disabled: false, states: { published: 1 } };
function request(body?: string) { return new Request("https://site.example/api/admin/scheduling/if/publish", { method: "POST", body }); }

beforeEach(() => {
  mocks.authorize.mockReset().mockResolvedValue({ ok: true, user: { id: 9 } });
  mocks.aircraft.mockReset().mockResolvedValue({ id: 7, if_aircraft_id: "10000000-0000-0000-0000-000000000001" });
  mocks.publish.mockReset().mockResolvedValue(result);
});

describe("admin IF publishing endpoint", () => {
  it.each([401, 403])("requires scheduling admin access before DB or IF work (HTTP %i)", async status => {
    const denied = Response.json({ error: "Denied" }, { status });
    mocks.authorize.mockResolvedValue({ ok: false, response: denied });
    const input = request('{"aircraftId":7}');
    expect(await POST(input)).toBe(denied);
    expect(denied.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.authorize).toHaveBeenCalledWith(input, "scheduling");
    expect(mocks.aircraft).not.toHaveBeenCalled(); expect(mocks.publish).not.toHaveBeenCalled();
  });
  it.each([undefined, "{}"])('runs one bounded whole-queue batch for body %s', async body => {
    const response = await POST(request(body));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ success: true, data: result });
    expect(mocks.publish).toHaveBeenCalledWith({}); expect(mocks.aircraft).not.toHaveBeenCalled();
    expect(maxDuration).toBe(30);
  });
  it("resolves a local aircraft before running only that tail's queued jobs", async () => {
    expect((await POST(request('{"aircraftId":7}'))).status).toBe(200);
    expect(mocks.aircraft).toHaveBeenCalledWith(7); expect(mocks.publish).toHaveBeenCalledWith({ aircraftId: 7 });
  });
  it.each(["{", "null", "[]", '{"aircraftId":0}', '{"aircraftId":1.5}', '{"aircraftId":"7"}', '{"aircraftId":null}', '{"aircraftId":9007199254740992}', '{"if_aircraft_id":"remote-id"}'])("rejects invalid scope or remote identifiers: %s", async body => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.publish).not.toHaveBeenCalled(); expect(mocks.aircraft).not.toHaveBeenCalled();
  });
  it("returns 404 for an unknown local aircraft without running any jobs", async () => {
    mocks.aircraft.mockResolvedValue(null);
    expect((await POST(request('{"aircraftId":7}'))).status).toBe(404); expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("returns 409 for an unlinked local aircraft without running other aircraft", async () => {
    mocks.aircraft.mockResolvedValue({ id: 7, if_aircraft_id: null });
    expect((await POST(request('{"aircraftId":7}'))).status).toBe(409); expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("reports disabled publishing reasons without claiming that anything was published", async () => {
    const disabled = { processed: 0, published: 0, disabled: true, reasons: ["Automatic IF publishing is disabled"] };
    mocks.publish.mockResolvedValue(disabled);
    expect(await (await POST(request("{}"))).json()).toEqual({ success: true, data: disabled });
  });
  it("preserves an IF rate limit and its retry delay", async () => {
    mocks.publish.mockRejectedValue(new IfLiveError("IF request budget reached", "rate_limited", 429, 45));
    const response = await POST(request("{}"));
    expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("45");
  });
  it("sanitizes database/provider failures", async () => {
    mocks.publish.mockRejectedValue(new Error("SQL included secret-token"));
    const response = await POST(request("{}"));
    expect(response.status).toBe(503); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.stringify(await response.json())).not.toContain("secret-token");
  });
});
