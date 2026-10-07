import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), aircraft: vi.fn(), flight: vi.fn(), publish: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ requirePermission: mocks.authorize }));
vi.mock("@/lib/scheduling/models", () => ({ LiveAircraft: { findByPk: mocks.aircraft }, LiveFlight: { findByPk: mocks.flight } }));
vi.mock("@/lib/scheduling/infinite-flight/publisher", () => ({ runIfLivePublisher: mocks.publish }));
import { IfLiveError } from "@/lib/scheduling/infinite-flight/config";
import { POST, maxDuration } from "./route";

const result = { processed: 1, published: 1, disabled: false, states: { published: 1 } };
function request(body?: string) { return new Request("https://site.example/api/admin/scheduling/if/publish", { method: "POST", body }); }

beforeEach(() => {
  mocks.authorize.mockReset().mockResolvedValue({ ok: true, user: { id: 9 } });
  mocks.aircraft.mockReset().mockResolvedValue({ id: 7, if_aircraft_id: "10000000-0000-0000-0000-000000000001" });
  mocks.flight.mockReset().mockResolvedValue({ id: 23, live_aircraft_id: 7, status: "approved" });
  mocks.publish.mockReset().mockResolvedValue(result);
});

describe("admin IF publishing endpoint", () => {
  it.each([401, 403])("requires scheduling admin access before DB or IF work (HTTP %i)", async status => {
    const denied = Response.json({ error: "Denied" }, { status });
    mocks.authorize.mockResolvedValue({ ok: false, response: denied });
    const input = request('{"flightId":23}');
    expect(await POST(input)).toBe(denied);
    expect(denied.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.authorize).toHaveBeenCalledWith(input, "scheduling");
    expect(mocks.aircraft).not.toHaveBeenCalled(); expect(mocks.flight).not.toHaveBeenCalled(); expect(mocks.publish).not.toHaveBeenCalled();
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
  it("resolves one approved flight and its linked aircraft without selecting that aircraft's other jobs", async () => {
    const flightResult = { ...result, flight: { id: 23, state: "published", message: "Published", revision: 4, publishedRevision: 4 } };
    mocks.publish.mockResolvedValue(flightResult);
    const response = await POST(request('{"flightId":23}')); expect(response.status).toBe(200);
    expect(mocks.flight).toHaveBeenCalledWith(23); expect(mocks.aircraft).toHaveBeenCalledWith(7); expect(mocks.publish).toHaveBeenCalledWith({ flightId: 23 });
    await expect(response.json()).resolves.toEqual({ success: true, data: flightResult });
  });
  it.each(["{", "null", "[]", '{"aircraftId":0}', '{"aircraftId":1.5}', '{"aircraftId":"7"}', '{"aircraftId":null}', '{"aircraftId":9007199254740992}', '{"if_aircraft_id":"remote-id"}',
    '{"flightId":0}', '{"flightId":-1}', '{"flightId":1.5}', '{"flightId":"23"}', '{"flightId":null}', '{"flightId":2147483648}', '{"aircraftId":7,"flightId":23}', '{"flightId":23,"actorId":9}'])("rejects invalid scope or remote identifiers: %s", async body => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.publish).not.toHaveBeenCalled(); expect(mocks.aircraft).not.toHaveBeenCalled(); expect(mocks.flight).not.toHaveBeenCalled();
  });
  it("returns 404 for an unknown local aircraft without running any jobs", async () => {
    mocks.aircraft.mockResolvedValue(null);
    expect((await POST(request('{"aircraftId":7}'))).status).toBe(404); expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("rejects an unknown local flight before checking its aircraft or running the queue", async () => {
    mocks.flight.mockResolvedValue(null);
    expect((await POST(request('{"flightId":23}'))).status).toBe(404); expect(mocks.aircraft).not.toHaveBeenCalled(); expect(mocks.publish).not.toHaveBeenCalled();
  });
  it.each(["pending", "rejected", "cancelled", "needs_review", "in_progress", "completed"])("rejects an individually selected %s flight before IF work", async status => {
    mocks.flight.mockResolvedValue({ id: 23, live_aircraft_id: 7, status });
    expect((await POST(request('{"flightId":23}'))).status).toBe(409); expect(mocks.aircraft).not.toHaveBeenCalled(); expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("rejects an unlinked flight's aircraft without publishing other jobs", async () => {
    mocks.aircraft.mockResolvedValue({ id: 7, if_aircraft_id: null });
    expect((await POST(request('{"flightId":23}'))).status).toBe(409); expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("returns a truthful blocked result without claiming that the selected flight was published", async () => {
    const blocked = { processed: 0, published: 0, disabled: false, states: {}, flight: { id: 23, state: "blocked", message: "Publish preceding approved flights first", revision: 4, publishedRevision: 0 } };
    mocks.publish.mockResolvedValue(blocked);
    await expect((await POST(request('{"flightId":23}'))).json()).resolves.toEqual({ success: true, data: blocked });
  });
  it("rejects query-based scope overrides before database or publishing work", async () => {
    const input = new Request("https://site.example/api/admin/scheduling/if/publish?flightId=23", { method: "POST", body: "{}" });
    expect((await POST(input)).status).toBe(400); expect(mocks.flight).not.toHaveBeenCalled(); expect(mocks.aircraft).not.toHaveBeenCalled(); expect(mocks.publish).not.toHaveBeenCalled();
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
