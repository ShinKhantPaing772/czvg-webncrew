import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), token: vi.fn(), organizations: vi.fn(), fleet: vi.fn(), position: vi.fn(), schedules: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ requirePermission: mocks.authorize }));
vi.mock("@/lib/scheduling/infinite-flight/connection", () => ({ getIfAccessToken: mocks.token }));
vi.mock("@/lib/scheduling/infinite-flight/client", () => ({ getIfOrganizations: mocks.organizations, getIfFleet: mocks.fleet, getIfPosition: mocks.position, getIfSchedules: mocks.schedules }));

import { IfLiveError } from "@/lib/scheduling/infinite-flight/config";
import { GET } from "./route";

const ORG = "10000000-0000-0000-0000-000000000001";
const AIRCRAFT = "10000000-0000-0000-0000-000000000002";
function request(query = "?organizationId=" + ORG + "&aircraftId=" + AIRCRAFT) { return new Request("https://example.com/api/admin/scheduling/if/fleet" + query); }
beforeEach(() => {
  vi.resetAllMocks(); mocks.authorize.mockResolvedValue({ ok: true, user: { id: 42 } }); mocks.token.mockResolvedValue("private-token");
  mocks.organizations.mockResolvedValue([{ id: ORG, name: "Our organization" }]); mocks.fleet.mockResolvedValue([{ id: AIRCRAFT, organizationId: ORG }]);
  mocks.position.mockResolvedValue({ latitude: 43.6777, longitude: -79.6248 }); mocks.schedules.mockResolvedValue([]);
});

describe("temporary admin IF fleet reads", () => {
  it.each([401, 403])("requires scheduling permission before reading IF: %i", async status => {
    const response = Response.json({ success: false, error: "Denied" }, { status }); mocks.authorize.mockResolvedValue({ ok: false, response });
    const input = request(); expect(await GET(input)).toBe(response);
    expect(mocks.authorize).toHaveBeenCalledWith(input, "scheduling"); expect(mocks.token).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns organizations or aircraft without fetching position or schedules", async () => {
    const organizations = await GET(request("")); await expect(organizations.json()).resolves.toEqual({ success: true, data: { organizations: [{ id: ORG, name: "Our organization" }] } });
    const fleet = await GET(request("?organizationId=" + ORG)); await expect(fleet.json()).resolves.toEqual({ success: true, data: { aircraft: [{ id: AIRCRAFT, organizationId: ORG }] } });
    expect(mocks.position).not.toHaveBeenCalled(); expect(mocks.schedules).not.toHaveBeenCalled();
    expect(organizations.headers.get("Cache-Control")).toBe("no-store"); expect(fleet.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each(["?organizationId=invalid", "?aircraftId=" + AIRCRAFT, "?organizationId=" + ORG + "&aircraftId=invalid"])("validates remote identifiers before accessing IF: %s", async query => {
    expect((await GET(request(query))).status).toBe(400); expect(mocks.token).not.toHaveBeenCalled();
  });

  it("rejects an aircraft outside the selected organization before fetching its data", async () => {
    mocks.fleet.mockResolvedValue([]); expect((await GET(request())).status).toBe(404);
    expect(mocks.position).not.toHaveBeenCalled(); expect(mocks.schedules).not.toHaveBeenCalled();
  });

  it("returns empty schedules when IF has no persisted position and sanitizes the position warning", async () => {
    mocks.position.mockRejectedValue(new IfLiveError("private-provider-position-details", "position_unavailable", 409));
    const response = await GET(request()); expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: { position: null, schedules: [], positionError: "IF has no persisted position for this aircraft." } });
    expect(mocks.schedules).toHaveBeenCalledWith("private-token", AIRCRAFT); expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("preserves returned schedules despite a missing persisted position", async () => {
    const schedule = { id: "schedule", callsign: "WNC1" }; mocks.schedules.mockResolvedValue([schedule]);
    mocks.position.mockRejectedValue(new IfLiveError("Missing position", "position_unavailable", 409));
    await expect((await GET(request())).json()).resolves.toMatchObject({ success: true, data: { position: null, schedules: [schedule] } });
  });

  it.each([new IfLiveError("Invalid IF position", "invalid_response", 502), new IfLiveError("IF denied this operation", "forbidden", 403), new Error("private-token-error")])("does not hide other position failures: %s", async error => {
    mocks.position.mockRejectedValue(error); const response = await GET(request()); expect(response.status).toBe(error instanceof IfLiveError ? error.status : 503);
    expect(response.headers.get("Cache-Control")).toBe("no-store"); expect(await response.text()).not.toContain("private-token-error");
  });

  it("does not report schedule failures as successful empty schedules", async () => {
    mocks.schedules.mockRejectedValue(new IfLiveError("Infinite Flight rate limit reached", "rate_limited", 429, 120));
    const response = await GET(request()); expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("120");
  });
});
