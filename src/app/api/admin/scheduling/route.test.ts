import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), changeAircraft: vi.fn(), changeFlight: vi.fn(), snapshot: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ requirePermission: mocks.authorize }));
vi.mock("@/lib/scheduling/service", () => ({
  changeAircraft: mocks.changeAircraft, changeFlight: mocks.changeFlight, schedulingSnapshot: mocks.snapshot,
  schedulingFailure: (error: { status?: number; message: string }) => ({ status: error.status ?? 500, error: error.message }),
}));

import { GET, PATCH, POST } from "./route";

function request(body: unknown, method = "POST") {
  return new Request("http://localhost/api/admin/scheduling", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => {
  mocks.authorize.mockReset().mockResolvedValue({ ok: true, user: { id: 9 } });
  mocks.changeAircraft.mockReset().mockResolvedValue({ live_aircraft_id: 3 });
  mocks.changeFlight.mockReset().mockResolvedValue({ flight_id: 10 });
  mocks.snapshot.mockReset().mockResolvedValue({ flights: [], aircraft: [] });
});

describe("admin scheduling API boundaries", () => {
  it("requires scheduling permission before exposing admin data", async () => {
    mocks.authorize.mockResolvedValue({ ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) });
    const request = new Request("http://localhost/api/admin/scheduling");
    expect((await GET(request)).status).toBe(403);
    expect(mocks.authorize).toHaveBeenCalledWith(request, "scheduling");
    expect(mocks.snapshot).not.toHaveBeenCalled();
  });

  it("creates manual live aircraft using the authenticated administrator", async () => {
    const body = { action: "add_aircraft", registration: "C-NEW", aircraft_id: 1, pilot_id: 1 };
    const response = await POST(request(body));
    expect(response.status).toBe(201);
    expect(mocks.changeAircraft).toHaveBeenCalledWith({ id: 9, admin: true }, body);
  });

  it("routes fleet edits and flight reviews to their corresponding domain operations", async () => {
    await PATCH(request({ action: "edit_aircraft", live_aircraft_id: 3 }, "PATCH"));
    await PATCH(request({ action: "approve", flight_id: 10 }, "PATCH"));
    expect(mocks.changeAircraft).toHaveBeenCalledOnce();
    expect(mocks.changeFlight).toHaveBeenCalledWith({ id: 9, admin: true }, { action: "approve", flight_id: 10 });
  });

  it("rejects unknown aircraft creation actions", async () => {
    expect((await POST(request({ action: "approve" }))).status).toBe(400);
    expect(mocks.changeAircraft).not.toHaveBeenCalled();
  });
});
