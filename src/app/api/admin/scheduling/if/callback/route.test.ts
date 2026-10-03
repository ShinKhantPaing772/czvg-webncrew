import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), store: vi.fn(), exchange: vi.fn(), state: vi.fn(), revoke: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ requirePermission: mocks.auth }));
vi.mock("@/lib/scheduling/infinite-flight/connection", () => ({ storeIfConnection: mocks.store }));
vi.mock("@/lib/scheduling/infinite-flight/oauth", () => ({ IF_STATE_COOKIE: "wnc_if_oauth_state", readIfAuthorizationState: mocks.state, exchangeIfAuthorization: mocks.exchange, revokeIfAuthorization: mocks.revoke }));
import { GET } from "./route";
const tokens = { accessToken: "if-secret-access", refreshToken: "if-secret-refresh", expiresAt: new Date("2026-10-03T15:00:00Z") };
beforeEach(() => {
  mocks.state.mockReturnValue({ token: "site-session-token", pilotId: 42, verifier: "pkce-verifier" });
  mocks.auth.mockResolvedValue({ ok: true, user: { id: 42 } }); mocks.exchange.mockResolvedValue(tokens); mocks.store.mockResolvedValue(undefined); mocks.revoke.mockResolvedValue(undefined);
});
afterEach(() => { vi.resetAllMocks(); });
function request(query = "state=state&code=code") { return new NextRequest(`https://site.example/api/admin/scheduling/if/callback?${query}`, { headers: { Cookie: "wnc_if_oauth_state=encrypted-state" } }); }
describe("IF callback authentication", () => {
  it("revalidates the initiating site's live session before exchanging credentials", async () => {
    mocks.auth.mockResolvedValue({ ok: false }); const response = await GET(request());
    expect(response.headers.get("Location")).toContain("reason=authentication"); expect(mocks.exchange).not.toHaveBeenCalled(); expect(mocks.store).not.toHaveBeenCalled();
  });
  it("rejects a callback if the validated site pilot differs from the initiating pilot", async () => {
    mocks.auth.mockResolvedValue({ ok: true, user: { id: 99 } }); await GET(request()); expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it("stores only after authentication and clears the HttpOnly state cookie", async () => {
    const response = await GET(request());
    const authRequest = mocks.auth.mock.calls[0][0] as Request; expect(authRequest.headers.get("Authorization")).toBe("Bearer site-session-token");
    expect(mocks.auth.mock.calls[0][1]).toBe("scheduling"); expect(mocks.store).toHaveBeenCalledWith(42, tokens);
    expect(response.headers.get("Location")).toBe("https://site.example/crew/admin/scheduling?if=connected");
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0"); expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(response.headers.get("Location")).not.toContain("secret");
  });
  it("does not exchange credentials when IF consent was declined", async () => {
    const response = await GET(request("state=state&error=access_denied")); expect(response.headers.get("Location")).toContain("reason=consent"); expect(mocks.exchange).not.toHaveBeenCalled();
  });
});
