import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { decryptIfSecret, encryptIfSecret } from "./crypto";
import { getIfLiveConfig } from "./config";
import { readIfAuthorizationState, startIfAuthorization, exchangeIfAuthorization, revokeIfAuthorization } from "./oauth";

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
  it("keeps the integration disabled when supported revocation or encryption config is missing", () => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", ""); vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", "");
    expect(getIfLiveConfig()).toMatchObject({ configured: false }); expect(getIfLiveConfig().disabledReasons).toHaveLength(2);
  });
  it("exchanges tokens server-side with confidential credentials and PKCE", async () => {
    const fetcher = vi.fn(async (_url: unknown, _options: RequestInit) => Response.json({ access_token: "access", refresh_token: "rotating", token_type: "Bearer", expires_in: 1800 })); vi.stubGlobal("fetch", fetcher);
    const value = await exchangeIfAuthorization("code", "verifier");
    expect(value.accessToken).toBe("access"); const options = fetcher.mock.calls[0][1] as unknown as RequestInit;
    expect(String(options.body)).toContain("code_verifier=verifier"); expect(String(options.body)).toContain("client_secret=client-secret");
  });
  it("can revoke an existing grant after preview access has been disabled", async () => {
    vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "false");
    vi.stubEnv("IF_LIVE_REDIRECT_URI", "");
    const fetcher = vi.fn(async () => new Response("", { status: 200 })); vi.stubGlobal("fetch", fetcher);
    await expect(revokeIfAuthorization("stored-token", "refresh_token")).resolves.toBeUndefined(); expect(fetcher).toHaveBeenCalledOnce();
    expect(getIfLiveConfig().configured).toBe(false);
  });
});
