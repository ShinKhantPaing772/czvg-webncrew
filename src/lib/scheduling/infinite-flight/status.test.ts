import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findConnection: vi.fn() }));
vi.mock("@/lib/database", () => ({ default: {} }));
vi.mock("@/lib/models", () => ({ models: {} }));
vi.mock("@/lib/scheduling/models", () => ({ IfLiveConnection: { findByPk: mocks.findConnection }, IfLiveOutbox: {}, LiveAircraft: {}, LiveFlight: {} }));
vi.mock("./client", () => ({ clearIfLiveCache: vi.fn(), getIfOrganizations: vi.fn() }));

import { ifIntegrationStatus } from "./connection";

beforeEach(() => {
  vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "false");
  vi.stubEnv("IF_LIVE_AUTO_PUBLISH_ENABLED", "true");
  vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "true");
  vi.stubEnv("IF_LIVE_CLIENT_ID", "test-client");
  vi.stubEnv("IF_LIVE_CLIENT_SECRET", "hidden-client-secret");
  vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("IF_LIVE_REVOCATION_URL", "https://api.infiniteflight.com/auth/v2/connect/revoke-supported-test");
  vi.stubEnv("IF_LIVE_REDIRECT_URI", "");
  mocks.findConnection.mockReset().mockResolvedValue({ state: "connected", organization_id: null, expires_at: null, access_token_encrypted: "hidden-encrypted-token", refresh_token_encrypted: "hidden-refresh-token" });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("IF integration setup status", () => {
  it("keeps disconnect available with preview and callback disabled", async () => {
    const status = await ifIntegrationStatus();
    expect(status).toMatchObject({ configured: false, enabled: false, bindingReady: false, canDisconnect: true, disconnectMode: "revoke", revocationConfigured: true, publishingReady: false, oauthSetup: { callbackUrl: null } });
    expect(JSON.stringify(status)).not.toContain("hidden-client-secret");
    expect(JSON.stringify(status)).not.toContain("hidden-encrypted-token");
    expect(JSON.stringify(status)).not.toContain("hidden-refresh-token");
    expect(status.connection).toEqual({ state: "connected", organizationId: null, expiresAt: null });
  });
  it("allows local disconnect without a revocation URL even when OAuth is disabled", async () => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", "");
    expect(await ifIntegrationStatus()).toMatchObject({ configured: false, revocationConfigured: false, publishingReady: false, canDisconnect: true, disconnectMode: "local" });
  });
  it("reports publishing ready and local disconnect when the optional URL is absent", async () => {
    vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "true");
    vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://ifczvg.com/oauth/callback");
    vi.stubEnv("IF_LIVE_REVOCATION_URL", "  ");
    const status = await ifIntegrationStatus();
    expect(status).toMatchObject({ configured: true, disabledReasons: [], bindingReady: true, bindingDisabledReasons: [], revocationConfigured: false, publishingReady: true, canDisconnect: true, disconnectMode: "local" });
    expect(status.publishingDisabledReasons).toEqual([]);
    expect(status.oauthSetup.checks.find(check => check.id === "revocation")).toMatchObject({ ready: false, required: false });
  });
  it("exposes binding readiness independently of publishing readiness without sensitive setup values", async () => {
    vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "true");
    vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://ifczvg.com/oauth/callback");
    vi.stubEnv("IF_LIVE_AUTO_PUBLISH_ENABLED", "false");
    vi.stubEnv("IF_LIVE_REVOCATION_URL", "");
    const status = await ifIntegrationStatus();
    expect(status).toMatchObject({ configured: true, bindingReady: true, bindingDisabledReasons: [], publishingReady: false });
    expect(JSON.stringify(status)).not.toContain("hidden-client-secret");
    expect(JSON.stringify(status)).not.toContain("hidden-encrypted-token");
    expect(JSON.stringify(status)).not.toContain(Buffer.alloc(32, 7).toString("base64"));
    vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "false");
    expect(await ifIntegrationStatus()).toMatchObject({ configured: true, bindingReady: false, bindingDisabledReasons: ["Durable IF mapping retention has not been authorized"] });
  });
  it("keeps local disconnect available without client credentials or an encryption key", async () => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", "");
    vi.stubEnv("IF_LIVE_CLIENT_ID", "");
    vi.stubEnv("IF_LIVE_CLIENT_SECRET", "");
    vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", "");
    const status = await ifIntegrationStatus();
    expect(status).toMatchObject({ configured: false, canDisconnect: true, disconnectMode: "local" });
    expect(JSON.stringify(status)).not.toContain("hidden-encrypted-token");
    expect(JSON.stringify(status)).not.toContain("hidden-refresh-token");
  });
  it("does not advertise local disconnect for a malformed nonempty revocation URL", async () => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", "https://user:hidden-revocation-password@untrusted.example/revoke");
    const status = await ifIntegrationStatus();
    expect(status).toMatchObject({ configured: false, revocationConfigured: false, publishingReady: false, canDisconnect: false, disconnectMode: "revoke" });
    expect(JSON.stringify(status)).not.toContain("hidden-revocation-password");
  });
  it("requires encryption for provider revocation while preserving its independent readiness", async () => {
    vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", "");
    expect(await ifIntegrationStatus()).toMatchObject({ configured: false, revocationConfigured: true, canDisconnect: false, disconnectMode: "revoke" });
  });
});
