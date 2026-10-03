import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), requestFlight: vi.fn(), changeFlight: vi.fn(), snapshot: vi.fn() }));
vi.mock("@/lib/scheduling/access", () => ({ requireLivePilotAuth: mocks.authorize }));
vi.mock("@/lib/scheduling/service", () => ({
  requestFlight: mocks.requestFlight, changeFlight: mocks.changeFlight, schedulingSnapshot: mocks.snapshot,
  schedulingFailure: (error: { status?: number; message: string }) => ({ status: error.status ?? 500, error: error.message }),
}));

import { GET, PATCH, POST } from "./route";

function request(body: unknown, method = "POST") {
  return new Request("http://localhost/api/scheduling", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => {
  mocks.authorize.mockReset().mockResolvedValue({ ok: true, user: { id: 1, permissions: ["admin"] } });
  mocks.requestFlight.mockReset().mockResolvedValue({ flight_id: 10 });
  mocks.changeFlight.mockReset().mockResolvedValue({ flight_id: 10 });
  mocks.snapshot.mockReset().mockResolvedValue({ flights: [], aircraft: [] });
});

describe("pilot scheduling API boundaries", () => {
  it("does not dispatch reads or mutations without live pilot authorization", async () => {
    const denied = Response.json({ error: "Award required" }, { status: 403 });
    mocks.authorize.mockResolvedValue({ ok: false, response: denied });
    expect((await GET(new Request("http://localhost/api/scheduling"))).status).toBe(403);
    expect((await POST(request({ action: "request" }))).status).toBe(403);
    expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(mocks.requestFlight).not.toHaveBeenCalled();
  });

  it("derives the actor from the session and keeps the pilot API at captain authority", async () => {
    const body = { action: "start", flight_id: 10, admin: true, pilot_id: 9 };
    expect((await PATCH(request(body, "PATCH"))).status).toBe(200);
    expect(mocks.changeFlight).toHaveBeenCalledWith({ id: 1, admin: false }, body);
  });

  it("returns 201 for a flight proposal", async () => {
    const response = await POST(request({ action: "request", live_aircraft_id: 1 }));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ success: true, flight_id: 10 });
  });

  it.each([null, [], { action: "approve" }])("rejects invalid proposal payload %j before dispatch", async body => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.requestFlight).not.toHaveBeenCalled();
  });

  it("preserves validation conflict responses from the domain", async () => {
    mocks.changeFlight.mockRejectedValue(Object.assign(new Error("Crew is full"), { status: 409 }));
    const response = await PATCH(request({ action: "approve_join", flight_id: 10 }, "PATCH"));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "Crew is full" });
  });
});
