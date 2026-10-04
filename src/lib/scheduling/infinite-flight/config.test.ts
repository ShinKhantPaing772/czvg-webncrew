import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getIfLiveConfig, requireIfLiveConfig, requireIfRevocationConfig } from "./config";

beforeEach(() => {
  vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "true");
  vi.stubEnv("IF_LIVE_AUTO_PUBLISH_ENABLED", "true");
  vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "true");
  vi.stubEnv("IF_LIVE_CLIENT_ID", "test-client");
  vi.stubEnv("IF_LIVE_CLIENT_SECRET", "hidden-client-secret");
  vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("IF_LIVE_REVOCATION_URL", "https://api.infiniteflight.com/auth/v2/connect/revoke-supported-test");
  vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://ifczvg.com/oauth/callback");
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("IF OAuth configuration", () => {
  it.each([
    "https://ifczvg.com/oauth/callback",
    "https://internal.ifczvg.com/oauth/callback",
    "https://ifczvg.com/api/admin/scheduling/if/callback",
  ])("accepts the registered or legacy callback %s", redirectUri => {
    vi.stubEnv("IF_LIVE_REDIRECT_URI", redirectUri);
    expect(getIfLiveConfig()).toMatchObject({ configured: true, oauthSetup: { callbackUrl: redirectUri } });
  });
  it.each([
    "https://user:hidden-password@ifczvg.com/oauth/callback",
    "https://ifczvg.com/oauth/callback?client_secret=hidden-password",
    "https://ifczvg.com/oauth/callback#hidden-password",
    "https://ifczvg.com/another/callback",
  ])("rejects an unsafe callback %s without exposing it in setup details", redirectUri => {
    vi.stubEnv("IF_LIVE_REDIRECT_URI", redirectUri);
    const config = getIfLiveConfig();
    expect(config.configured).toBe(false);
    expect(config.oauthSetup.callbackUrl).toBeNull();
    expect(config.oauthSetup.checks.find(check => check.id === "callback")?.ready).toBe(false);
    expect(JSON.stringify(config.oauthSetup)).not.toContain("hidden-password");
  });
  it("provides setup readiness without exposing client secrets or encryption keys", () => {
    const setup = getIfLiveConfig().oauthSetup;
    expect(setup.checks.map(check => check.id)).toEqual(["preview", "client", "callback", "revocation", "encryption"]);
    expect(setup.checks.every(check => check.ready)).toBe(true);
    expect(setup.checks.filter(check => !check.required).map(check => check.id)).toEqual(["revocation"]);
    expect(JSON.stringify(setup)).not.toContain("hidden-client-secret");
    expect(JSON.stringify(setup)).not.toContain(Buffer.alloc(32, 7).toString("base64"));
  });
  it("permits revocation while preview access and callback configuration are disabled", () => {
    vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "false");
    vi.stubEnv("IF_LIVE_REDIRECT_URI", "");
    expect(getIfLiveConfig().configured).toBe(false);
    expect(() => requireIfRevocationConfig()).not.toThrow();
  });
  it("permits localhost HTTP only outside production", () => {
    vi.stubEnv("IF_LIVE_REDIRECT_URI", "http://localhost:3000/oauth/callback");
    vi.stubEnv("NODE_ENV", "development");
    expect(getIfLiveConfig().configured).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(getIfLiveConfig().configured).toBe(false);
  });
  it.each([
    { label: "unset", value: undefined },
    { label: "empty", value: "" },
    { label: "whitespace", value: "  \t " },
  ])("keeps OAuth ready with a $label revocation URL while disabling publishing", ({ value }) => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", value);
    const config = getIfLiveConfig();
    expect(config).toMatchObject({ configured: true, disabledReasons: [], revocationConfigured: false, publishingReady: false });
    expect(config.publishingDisabledReasons).toEqual(["Automatic IF publishing requires a supported OAuth revocation URL"]);
    expect(config.oauthSetup.checks.find(check => check.id === "revocation")).toMatchObject({ ready: false, required: false });
    expect(() => requireIfLiveConfig()).not.toThrow();
    expect(() => requireIfLiveConfig(true)).toThrow(expect.objectContaining({ code: "disabled" }));
    expect(() => requireIfRevocationConfig()).toThrow(expect.objectContaining({ code: "configuration" }));
  });
  it.each([
    "not-a-url",
    "http://api.infiniteflight.com/revoke",
    "https://untrusted.example/revoke?secret=hidden-password",
    "https://user:hidden-password@api.infiniteflight.com/revoke",
    "https://api.infiniteflight.com/revoke#hidden-password",
  ])("rejects an invalid nonempty revocation URL %s without exposing its values", value => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", value);
    const config = getIfLiveConfig();
    expect(config).toMatchObject({ configured: false, revocationConfigured: false, publishingReady: false });
    expect(() => requireIfLiveConfig()).toThrow(expect.objectContaining({ code: "configuration" }));
    expect(() => requireIfRevocationConfig()).toThrow(expect.objectContaining({ code: "configuration" }));
    expect(JSON.stringify({ reasons: config.disabledReasons, publishingReasons: config.publishingDisabledReasons, setup: config.oauthSetup })).not.toContain("hidden-password");
  });
  it("requires every publishing gate even when OAuth and revocation are ready", () => {
    vi.stubEnv("IF_LIVE_AUTO_PUBLISH_ENABLED", "false");
    vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "false");
    const config = getIfLiveConfig();
    expect(config).toMatchObject({ configured: true, revocationConfigured: true, publishingReady: false });
    expect(config.publishingDisabledReasons).toEqual(["Automatic IF publishing is disabled", "Durable IF mapping retention has not been authorized"]);
    expect(() => requireIfLiveConfig(true)).toThrow(expect.objectContaining({ code: "disabled" }));
  });
  it("permits publishing once OAuth, retained identifiers, automatic publishing and revocation are ready", () => {
    expect(getIfLiveConfig()).toMatchObject({ configured: true, revocationConfigured: true, publishingReady: true, publishingDisabledReasons: [] });
    expect(() => requireIfLiveConfig(true)).not.toThrow();
  });
  it("still rejects revocation without a URL when preview and callback are disabled", () => {
    vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "false");
    vi.stubEnv("IF_LIVE_REDIRECT_URI", "");
    vi.stubEnv("IF_LIVE_REVOCATION_URL", "");
    expect(() => requireIfRevocationConfig()).toThrow(expect.objectContaining({ code: "configuration" }));
  });
});
