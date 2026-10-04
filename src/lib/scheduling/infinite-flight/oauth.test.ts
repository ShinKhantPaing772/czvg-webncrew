import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { decryptIfSecret, encryptIfSecret } from "./crypto";
import { getIfLiveConfig } from "./config";
import { readIfAuthorizationState, startIfAuthorization, exchangeIfAuthorization, refreshIfAuthorization, revokeIfAuthorization } from "./oauth";

beforeEach(() => {
  vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "true"); vi.stubEnv("IF_LIVE_CLIENT_ID", "ifc_test"); vi.stubEnv("IF_LIVE_CLIENT_SECRET", "client-secret");
  vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://example.com/api/admin/scheduling/if/callback");
  vi.stubEnv("IF_LIVE_REVOCATION_URL", "https://api.infiniteflight.com/auth/v2/connect/revoke-supported-test");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("IF OAuth credentials and state", () => {
  it("encrypts secrets with authenticated ciphertext and rejects tampering", () => {
    const value = encryptIfSecret("token"); expect(value).not.toContain("token"); expect(decryptIfSecret(value)).toBe("token");
    const parts = value.split("."); parts[3] = Buffer.from("changed").toString("base64url");
    expect(() => decryptIfSecret(parts.join("."))).toThrow("could not be decrypted");
  });
  it("binds PKCE callback state to the initiating session and expires it", () => {
    vi.useFakeTimers(); const value = startIfAuthorization(42, "original-site-token"); const url = new URL(value.authorizationUrl);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256"); expect(url.toString()).not.toContain("original-site-token"); expect(url.toString()).not.toContain("client-secret");
    const state = url.searchParams.get("state")!;
    expect(readIfAuthorizationState(value.encryptedState, state)).toMatchObject({ pilotId: 42, token: "original-site-token" });
    expect(() => readIfAuthorizationState(value.encryptedState, "wrong")).toThrow();
    vi.advanceTimersByTime(600_001); expect(() => readIfAuthorizationState(value.encryptedState, state)).toThrow("expired");
  });
  it("rejects state if the exact registered callback changed after initiation", () => {
    vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://ifczvg.com/oauth/callback");
    const value = startIfAuthorization(42, "original-site-token");
    const state = new URL(value.authorizationUrl).searchParams.get("state")!;
    vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://internal.ifczvg.com/oauth/callback");
    expect(() => readIfAuthorizationState(value.encryptedState, state)).toThrow("could not be verified");
  });
  it("keeps OAuth disabled without token encryption even when revocation is optional", () => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", ""); vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", "");
    expect(getIfLiveConfig()).toMatchObject({ configured: false });
    expect(getIfLiveConfig().disabledReasons).toEqual(["The IF token encryption key is missing or invalid"]);
  });
  it("starts and verifies the confidential PKCE flow without a revocation URL", () => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", "");
    const value = startIfAuthorization(42, "original-site-token");
    const authorization = new URL(value.authorizationUrl);
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorization.searchParams.get("redirect_uri")).toBe("https://example.com/api/admin/scheduling/if/callback");
    expect(readIfAuthorizationState(value.encryptedState, authorization.searchParams.get("state")!)).toMatchObject({ pilotId: 42, token: "original-site-token" });
  });
  it("exchanges an authorization code without a revocation URL while retaining confidential credentials and PKCE", async () => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", "");
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
    const fetcher = vi.fn(async (_url: unknown, _options: RequestInit) => Response.json({ access_token: "access", refresh_token: "rotating", token_type: "Bearer", expires_in: 1800 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(exchangeIfAuthorization("authorization-code", "pkce-verifier")).resolves.toEqual({ accessToken: "access", refreshToken: "rotating", expiresAt: new Date("2026-10-04T12:30:00Z") });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.infiniteflight.com/auth/v2/connect/token");
    expect(options).toMatchObject({ method: "POST", cache: "no-store", redirect: "error" });
    expect(Object.fromEntries(new URLSearchParams(String(options.body)))).toEqual({
      client_id: "ifc_test", client_secret: "client-secret", grant_type: "authorization_code", code: "authorization-code",
      redirect_uri: "https://example.com/api/admin/scheduling/if/callback", code_verifier: "pkce-verifier",
    });
  });
  it("refreshes and rotates credentials without a revocation URL", async () => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", "  ");
    const fetcher = vi.fn(async (_url: unknown, _options: RequestInit) => Response.json({ access_token: "new-access", refresh_token: "new-refresh", token_type: "Bearer", expires_in: 1800 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(refreshIfAuthorization("old-refresh")).resolves.toMatchObject({ accessToken: "new-access", refreshToken: "new-refresh", expiresAt: expect.any(Date) });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.infiniteflight.com/auth/v2/connect/token");
    expect(options).toMatchObject({ method: "POST", cache: "no-store", redirect: "error" });
    expect(Object.fromEntries(new URLSearchParams(String(options.body)))).toEqual({ client_id: "ifc_test", client_secret: "client-secret", grant_type: "refresh_token", refresh_token: "old-refresh" });
  });
  it.each(["access_token", "refresh_token"] as const)("rejects direct %s revocation without its endpoint before sending credentials", async type => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", "");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(revokeIfAuthorization("stored-secret", type)).rejects.toMatchObject({ code: "configuration", message: expect.stringContaining("revocation URL") });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { operation: "authorization exchange", run: () => exchangeIfAuthorization("authorization-code", "pkce-verifier") },
    { operation: "token refresh", run: () => refreshIfAuthorization("stored-refresh") },
  ])("rejects $operation with an invalid nonempty revocation URL before network access", async ({ run }) => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", "https://untrusted.example/revoke");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(run()).rejects.toMatchObject({ code: "configuration", message: expect.stringContaining("revocation URL is invalid") });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("exchanges tokens server-side with confidential credentials and PKCE", async () => {
    const fetcher = vi.fn(async (_url: unknown, _options: RequestInit) => Response.json({ access_token: "access", refresh_token: "rotating", token_type: "Bearer", expires_in: 1800 })); vi.stubGlobal("fetch", fetcher);
    const value = await exchangeIfAuthorization("code", "verifier");
    expect(value.accessToken).toBe("access"); const options = fetcher.mock.calls[0][1] as unknown as RequestInit;
    expect(String(options.body)).toContain("code_verifier=verifier"); expect(String(options.body)).toContain("client_secret=client-secret");
    expect(options.redirect).toBe("error");
  });
  it("binds the token exchange to the same callback used during authorization", async () => {
    const fetcher = vi.fn(async () => Response.json({ access_token: "access", token_type: "Bearer", expires_in: 1800 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(exchangeIfAuthorization("code", "verifier", "https://other.example/oauth/callback")).rejects.toMatchObject({ code: "oauth_state" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([302, 307, 308])("rejects an OAuth endpoint redirect HTTP %i without accepting credentials", async status => {
    const fetcher = vi.fn(async () => new Response(null, { status, headers: { Location: "https://other.example/token" } }));
    vi.stubGlobal("fetch", fetcher);
    await expect(exchangeIfAuthorization("code", "verifier")).rejects.toMatchObject({ code: "oauth_exchange", status: 502 });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("rejects a successful response reported as redirected", async () => {
    const response = Response.json({ access_token: "access", token_type: "Bearer", expires_in: 1800 });
    Object.defineProperty(response, "redirected", { value: true });
    vi.stubGlobal("fetch", vi.fn(async () => response));
    await expect(exchangeIfAuthorization("code", "verifier")).rejects.toMatchObject({ code: "oauth_exchange" });
  });
  it("accepts a case-insensitive Bearer token type and prevents date overflow", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: "access", token_type: "bearer", expires_in: 1800 }))
      .mockResolvedValueOnce(Response.json({ access_token: "access", token_type: "Bearer", expires_in: 1e300 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(exchangeIfAuthorization("code", "verifier")).resolves.toMatchObject({ accessToken: "access" });
    await expect(exchangeIfAuthorization("code", "verifier")).rejects.toMatchObject({ code: "oauth_exchange", status: 502 });
  });
  it("does not follow credential-bearing refresh or revocation redirects", async () => {
    const fetcher = vi.fn(async (_url: unknown, _options: RequestInit) => Response.json({ access_token: "access", token_type: "Bearer", expires_in: 1800 }));
    vi.stubGlobal("fetch", fetcher);
    await refreshIfAuthorization("refresh-secret");
    await revokeIfAuthorization("access-secret", "access_token");
    for (const [, options] of fetcher.mock.calls) expect(options.redirect).toBe("error");
  });
  it("fails closed on malformed or rejected token responses without exposing provider data", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("provider-secret malformed", { status: 200 }))
      .mockResolvedValueOnce(Response.json({ access_token: "", token_type: "Bearer", expires_in: 1800 }))
      .mockResolvedValueOnce(new Response("provider-secret failure", { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(exchangeIfAuthorization("code", "verifier")).rejects.toMatchObject({ code: "oauth_exchange" });
    await expect(exchangeIfAuthorization("code", "verifier")).rejects.toMatchObject({ code: "oauth_exchange" });
    await expect(exchangeIfAuthorization("code", "verifier")).rejects.toMatchObject({ code: "reauth_required", message: expect.not.stringContaining("provider-secret") });
  });
  it("can revoke an existing grant after preview access has been disabled", async () => {
    vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "false");
    vi.stubEnv("IF_LIVE_REDIRECT_URI", "");
    const fetcher = vi.fn(async () => new Response("", { status: 200 })); vi.stubGlobal("fetch", fetcher);
    await expect(revokeIfAuthorization("stored-token", "refresh_token")).resolves.toBeUndefined(); expect(fetcher).toHaveBeenCalledOnce();
    expect(getIfLiveConfig().configured).toBe(false);
  });
});
