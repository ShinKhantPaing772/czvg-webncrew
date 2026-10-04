import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), store: vi.fn(), exchange: vi.fn(), state: vi.fn(), revoke: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ requirePermission: mocks.auth }));
vi.mock("@/lib/scheduling/infinite-flight/connection", () => ({ storeIfConnection: mocks.store }));
vi.mock("@/lib/scheduling/infinite-flight/oauth", () => ({ IF_STATE_COOKIE: "wnc_if_oauth_state", readIfAuthorizationState: mocks.state, exchangeIfAuthorization: mocks.exchange, revokeIfAuthorization: mocks.revoke }));
import { GET } from "./route";
const tokens = { accessToken: "if-secret-access", refreshToken: "if-secret-refresh", expiresAt: new Date("2026-10-03T15:00:00Z") };
beforeEach(() => {
  vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://site.example/api/admin/scheduling/if/callback");
  mocks.state.mockReturnValue({ token: "site-session-token", pilotId: 42, verifier: "pkce-verifier", redirectUri: "https://site.example/api/admin/scheduling/if/callback" });
  mocks.auth.mockResolvedValue({ ok: true, user: { id: 42 } }); mocks.exchange.mockResolvedValue(tokens); mocks.store.mockResolvedValue(undefined); mocks.revoke.mockResolvedValue(undefined);
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
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
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(mocks.exchange).toHaveBeenCalledWith("code", "pkce-verifier", "https://site.example/api/admin/scheduling/if/callback");
    expect(response.headers.get("Location")).not.toContain("secret");
  });
  it("does not exchange credentials when IF consent was declined", async () => {
    const response = await GET(request("state=state&error=access_denied")); expect(response.headers.get("Location")).toContain("reason=consent"); expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it.each(["https://ifczvg.com/oauth/callback", "https://internal.ifczvg.com/oauth/callback"])("accepts the registered callback %s and clears that cookie path", async callback => {
    vi.stubEnv("IF_LIVE_REDIRECT_URI", callback);
    mocks.state.mockReturnValue({ token: "site-session-token", pilotId: 42, verifier: "pkce-verifier", redirectUri: callback });
    const response = await GET(new NextRequest(`${callback}?state=state&code=code`, { headers: { Cookie: "wnc_if_oauth_state=encrypted-state" } }));
    expect(response.headers.get("Location")).toBe(`${new URL(callback).origin}/crew/admin/scheduling?if=connected`);
    expect(response.headers.get("Set-Cookie")).toContain("Path=/oauth/callback");
    expect(mocks.exchange).toHaveBeenCalledWith("code", "pkce-verifier", callback);
  });
  it("rejects a callback at a different origin before decrypting or exchanging credentials", async () => {
    const response = await GET(new NextRequest("https://other.example/api/admin/scheduling/if/callback?state=state&code=code", { headers: { Cookie: "wnc_if_oauth_state=encrypted-state" } }));
    expect(response.headers.get("Location")).toBe("https://site.example/crew/admin/scheduling?if=error&reason=callback_origin");
    expect(mocks.state).not.toHaveBeenCalled();
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it("rejects a callback at a different path even on the correct domain", async () => {
    vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://site.example/oauth/callback");
    const response = await GET(request());
    expect(response.headers.get("Location")).toContain("reason=callback_origin");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it("returns a safe configuration error without deriving a redirect from the request host", async () => {
    vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://user:secret@site.example/oauth/callback");
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(response.headers.has("Location")).toBe(false);
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
  it("attempts revocation of both issued tokens if storing the connection fails", async () => {
    mocks.store.mockRejectedValue(new Error("Concurrent connection won"));
    mocks.revoke.mockRejectedValueOnce(new Error("Refresh revocation unavailable"));
    const response = await GET(request());
    expect(mocks.revoke).toHaveBeenCalledWith("if-secret-refresh", "refresh_token");
    expect(mocks.revoke).toHaveBeenCalledWith("if-secret-access", "access_token");
    expect(response.headers.get("Location")).toContain("if=error");
    expect(response.headers.get("Location")).not.toContain("secret");
  });
});
