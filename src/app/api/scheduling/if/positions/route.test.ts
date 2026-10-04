import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ requireCrewAuth: mocks.auth }));
vi.mock("@/lib/scheduling/infinite-flight/aircraft-positions", () => ({ loadIfAircraftPositions: mocks.load }));
import { GET } from "./route";
const request = () => new Request("https://example.com/api/scheduling/if/positions?aircraftIds=7");
beforeEach(() => vi.resetAllMocks()); afterEach(() => vi.unstubAllEnvs());
describe("positions are admin-only", () => {
  it.each([401, 403])("preserves authentication denial %i without reading IF data", async status => {
    const response = Response.json({ error: "Denied" }, { status }); mocks.auth.mockResolvedValue({ ok: false, response });
    expect(await GET(request())).toBe(response); expect(mocks.load).not.toHaveBeenCalled(); expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it.each([[], ["admin"]].map(permissions => ({ permissions })))("does not expose positions on the pilot endpoint for permissions $permissions", async ({ permissions }) => {
    mocks.auth.mockResolvedValue({ ok: true, user: { id: 42, permissions } });
    const response = await GET(request()); expect(response.status).toBe(403); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toContain("scheduling administrators only"); expect(mocks.load).not.toHaveBeenCalled();
  });
  it("sanitizes authentication errors without upstream data access", async () => {
    mocks.auth.mockRejectedValue(new Error("private token")); const response = await GET(request());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("private token"); expect(mocks.load).not.toHaveBeenCalled();
  });
});
