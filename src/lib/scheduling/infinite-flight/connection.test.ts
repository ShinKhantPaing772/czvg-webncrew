import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), query: vi.fn(), connection: { findByPk: vi.fn() },
  pilot: { findByPk: vi.fn() }, permission: { findAll: vi.fn() },
  aircraft: { count: vi.fn() }, flight: { count: vi.fn() }, outbox: { count: vi.fn() },
  refresh: vi.fn(), revoke: vi.fn(), clearCache: vi.fn(), organizations: vi.fn(),
}));
vi.mock("@/lib/database", () => ({ default: { transaction: mocks.transaction, query: mocks.query } }));
vi.mock("@/lib/models", () => ({ models: { Pilot: mocks.pilot, Permission: mocks.permission } }));
vi.mock("@/lib/scheduling/models", () => ({ IfLiveConnection: mocks.connection, IfLiveOutbox: mocks.outbox, LiveAircraft: mocks.aircraft, LiveFlight: mocks.flight }));
vi.mock("./oauth", () => ({ refreshIfAuthorization: mocks.refresh, revokeIfAuthorization: mocks.revoke }));
vi.mock("./client", () => ({ clearIfLiveCache: mocks.clearCache, getIfOrganizations: mocks.organizations }));

import { configureIfOrganization, disconnectIfConnection, getIfAccessToken, getIfAuthorizationSnapshot, storeIfConnection } from "./connection";
import { decryptIfSecret, encryptIfSecret } from "./crypto";
import { IfLiveError } from "./config";

const ORG = "10000000-0000-0000-0000-000000000001";
let row: any;
let transaction: any;
beforeEach(() => {
  vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "true"); vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "true");
  vi.stubEnv("IF_LIVE_CLIENT_ID", "ifc_test"); vi.stubEnv("IF_LIVE_CLIENT_SECRET", "client-secret");
  vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://internal.example.com/oauth/callback");
  vi.stubEnv("IF_LIVE_REVOCATION_URL", "https://api.infiniteflight.com/supported-test-revoke");
  transaction = { LOCK: { UPDATE: "UPDATE" } };
  mocks.transaction.mockImplementation(async callback => callback(transaction));
  mocks.query.mockResolvedValue([{ name: "live_scheduling_mutex" }]);
  row = { id: 1, connected_by: 42, state: "connected", organization_id: null,
    access_token_encrypted: encryptIfSecret("old-access"), refresh_token_encrypted: encryptIfSecret("old-refresh"), expires_at: new Date(Date.now() + 1_800_000),
    update: vi.fn(async function(this: any, values: any) { Object.assign(this, values); return this; }),
  };
  mocks.connection.findByPk.mockImplementation(async () => row);
  mocks.pilot.findByPk.mockResolvedValue({ status: 1 }); mocks.permission.findAll.mockResolvedValue([{ name: "scheduling" }]);
  mocks.aircraft.count.mockResolvedValue(0); mocks.flight.count.mockResolvedValue(0); mocks.outbox.count.mockResolvedValue(0);
  mocks.organizations.mockResolvedValue([{ id: ORG, name: "Organization" }]);
  mocks.refresh.mockResolvedValue({ accessToken: "new-access", refreshToken: "new-refresh", expiresAt: new Date(Date.now() + 1_800_000) });
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

describe("IF connection refresh and organization selection", () => {
  it("returns account, credential, organization and token from the same locked snapshot", async () => {
    row.organization_id = ORG;
    const authorization = await getIfAuthorizationSnapshot();
    expect(authorization).toEqual({ token: "old-access", credential: row.access_token_encrypted, owner: 42, organizationId: ORG });
    expect(mocks.connection.findByPk).toHaveBeenCalledWith(1, { transaction, lock: "UPDATE" });
  });
  it("returns a valid credential only after checking the connection owner's current site access", async () => {
    await expect(getIfAccessToken()).resolves.toBe("old-access");
    expect(mocks.pilot.findByPk).toHaveBeenCalledWith(42, expect.anything()); expect(mocks.permission.findAll).toHaveBeenCalledOnce();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("replaces rotating refresh tokens under the singleton lock", async () => {
    row.expires_at = new Date(0);
    await expect(getIfAccessToken()).resolves.toBe("new-access");
    expect(mocks.refresh).toHaveBeenCalledWith("old-refresh"); expect(decryptIfSecret(row.access_token_encrypted)).toBe("new-access");
    expect(decryptIfSecret(row.refresh_token_encrypted)).toBe("new-refresh");
    expect(mocks.connection.findByPk).toHaveBeenCalledWith(1, { transaction, lock: "UPDATE" }); expect(mocks.clearCache).toHaveBeenCalledOnce();
  });
  it("does not retain a consumed refresh token when IF omits its replacement", async () => {
    row.expires_at = new Date(0); mocks.refresh.mockResolvedValue({ accessToken: "new-access", refreshToken: null, expiresAt: new Date(Date.now() + 1_800_000) });
    await expect(getIfAccessToken()).rejects.toMatchObject({ code: "reauth_required" });
    expect(row.refresh_token_encrypted).toBeNull(); expect(row.state).toBe("reauth_required");
    expect(decryptIfSecret(row.access_token_encrypted)).toBe("new-access");
    await expect(getIfAccessToken()).rejects.toMatchObject({ code: "not_connected" }); expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it.each([{ status: 0, permissions: [{ name: "scheduling" }] }, { status: 1, permissions: [] }])("suspends credentials when the owner loses active status or permission: %j", async value => {
    mocks.pilot.findByPk.mockResolvedValue({ status: value.status }); mocks.permission.findAll.mockResolvedValue(value.permissions);
    await expect(getIfAccessToken()).rejects.toMatchObject({ code: "access_suspended" });
    expect(row.state).toBe("access_suspended"); expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("requires reauthorization after an uncertain rotating-token exchange", async () => {
    row.expires_at = new Date(0); mocks.refresh.mockRejectedValue(new IfLiveError("Unconfirmed exchange", "oauth_exchange", 502));
    await expect(getIfAccessToken()).rejects.toMatchObject({ code: "oauth_exchange" }); expect(row.state).toBe("reauth_required");
    await expect(getIfAccessToken()).rejects.toMatchObject({ code: "not_connected" }); expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it("saves an organization only for the same credential that verified membership", async () => {
    await expect(configureIfOrganization(ORG)).resolves.toBeUndefined();
    expect(row.organization_id).toBe(ORG); expect(mocks.organizations).toHaveBeenCalledWith("old-access");
    expect(mocks.permission.findAll).toHaveBeenCalledTimes(2); expect(mocks.query).toHaveBeenCalledOnce();
  });
  it("rejects a reconnect that occurs after fetching the previous account's organizations", async () => {
    const oldRow = row;
    mocks.organizations.mockImplementation(async () => {
      row = { ...oldRow, connected_by: 43, access_token_encrypted: encryptIfSecret("replacement-access"), update: vi.fn() };
      return [{ id: ORG, name: "Previous account organization" }];
    });
    await expect(configureIfOrganization(ORG)).rejects.toMatchObject({ code: "connection_changed" });
    expect(row.update).not.toHaveBeenCalled(); expect(oldRow.update).not.toHaveBeenCalled();
  });
  it("rejects a replacement grant even when the provider returns the same access token", async () => {
    mocks.organizations.mockImplementation(async () => {
      row.access_token_encrypted = encryptIfSecret("old-access");
      return [{ id: ORG, name: "Organization" }];
    });
    await expect(configureIfOrganization(ORG)).rejects.toMatchObject({ code: "connection_changed" }); expect(row.update).not.toHaveBeenCalled();
  });
  it("rechecks the current owner's permission after the membership request", async () => {
    mocks.organizations.mockImplementation(async () => { mocks.permission.findAll.mockResolvedValue([]); return [{ id: ORG, name: "Organization" }]; });
    await expect(configureIfOrganization(ORG)).rejects.toMatchObject({ code: "access_suspended" }); expect(row.update).not.toHaveBeenCalled();
  });
  it("reads and refreshes a connected account without a revocation URL", async () => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", "");
    await expect(getIfAccessToken()).resolves.toBe("old-access");
    row.expires_at = new Date(0);
    await expect(getIfAccessToken()).resolves.toBe("new-access");
    expect(mocks.refresh).toHaveBeenCalledWith("old-refresh");
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(row.state).toBe("connected");
  });
  it("stores a new grant and selects its organization without the optional revocation endpoint", async () => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", "");
    Object.assign(row, { access_token_encrypted: null, refresh_token_encrypted: null, state: "disconnected" });
    await storeIfConnection(42, { accessToken: "linked-access", refreshToken: "linked-refresh", expiresAt: new Date(Date.now() + 1_800_000) });
    expect(decryptIfSecret(row.access_token_encrypted)).toBe("linked-access");
    expect(decryptIfSecret(row.refresh_token_encrypted)).toBe("linked-refresh");
    await expect(configureIfOrganization(ORG)).resolves.toBeUndefined();
    expect(mocks.organizations).toHaveBeenCalledWith("linked-access");
    expect(row.organization_id).toBe(ORG);
    expect(mocks.revoke).not.toHaveBeenCalled();
  });
});

describe("IF connection disconnect outcomes", () => {
  it.each([
    { label: "unset", value: undefined },
    { label: "empty", value: "" },
    { label: "whitespace", value: " \t " },
  ])("clears credentials locally with a $label endpoint and no working OAuth configuration", async ({ value }) => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", value);
    vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "false");
    vi.stubEnv("IF_LIVE_CLIENT_ID", ""); vi.stubEnv("IF_LIVE_CLIENT_SECRET", "");
    vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", ""); vi.stubEnv("IF_LIVE_REDIRECT_URI", "");
    // These values cannot be decrypted; clearing them must not require recovery
    // of the original key or a successful provider request.
    Object.assign(row, { access_token_encrypted: "undecryptable-access", refresh_token_encrypted: "undecryptable-refresh", organization_id: ORG });
    await expect(disconnectIfConnection()).resolves.toEqual({ revocation: "local_only" });
    expect(mocks.connection.findByPk).toHaveBeenCalledWith(1, { transaction, lock: "UPDATE" });
    expect(row.update).toHaveBeenCalledWith({ access_token_encrypted: null, refresh_token_encrypted: null, expires_at: null, state: "disconnected" }, { transaction });
    expect(row).toMatchObject({ access_token_encrypted: null, refresh_token_encrypted: null, expires_at: null, state: "disconnected", organization_id: ORG, connected_by: 42 });
    expect(mocks.revoke).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled(); expect(mocks.organizations).not.toHaveBeenCalled();
    expect(mocks.clearCache).toHaveBeenCalledOnce();
  });
  it("revokes both stored tokens before clearing the singleton", async () => {
    const original = { access: row.access_token_encrypted, refresh: row.refresh_token_encrypted };
    mocks.revoke.mockImplementation(async () => {
      expect(row.access_token_encrypted).toBe(original.access);
      expect(row.refresh_token_encrypted).toBe(original.refresh);
      expect(row.update).not.toHaveBeenCalled();
    });
    await expect(disconnectIfConnection()).resolves.toEqual({ revocation: "revoked" });
    expect(mocks.revoke).toHaveBeenNthCalledWith(1, "old-refresh", "refresh_token");
    expect(mocks.revoke).toHaveBeenNthCalledWith(2, "old-access", "access_token");
    expect(row).toMatchObject({ access_token_encrypted: null, refresh_token_encrypted: null, expires_at: null, state: "disconnected" });
    expect(mocks.clearCache).toHaveBeenCalledOnce();
  });
  it.each([
    { failing: "refresh", expectedCalls: 1 },
    { failing: "access", expectedCalls: 2 },
  ])("retains local credentials when $failing token revocation fails", async ({ failing, expectedCalls }) => {
    const original = { access: row.access_token_encrypted, refresh: row.refresh_token_encrypted, expiry: row.expires_at };
    mocks.revoke.mockImplementation(async (token: string) => {
      if (token === `old-${failing}`) throw new IfLiveError("Provider did not confirm revocation", "unavailable", 502);
    });
    await expect(disconnectIfConnection()).rejects.toMatchObject({ code: "unavailable" });
    // The transaction mock cannot undo updates. This assertion verifies there
    // is no local write before all configured revocation requests succeed.
    expect(row.update).not.toHaveBeenCalled();
    expect(row).toMatchObject({ access_token_encrypted: original.access, refresh_token_encrypted: original.refresh, expires_at: original.expiry, state: "connected" });
    expect(mocks.revoke).toHaveBeenCalledTimes(expectedCalls);
    expect(mocks.clearCache).not.toHaveBeenCalled();
  });
  it("does not fall back to local disconnect for an invalid nonempty endpoint", async () => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", "https://untrusted.example/revoke");
    await expect(disconnectIfConnection()).rejects.toMatchObject({ code: "configuration" });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.revoke).not.toHaveBeenCalled(); expect(row.update).not.toHaveBeenCalled();
    expect(mocks.clearCache).not.toHaveBeenCalled();
  });
  it("retains credentials when provider revocation cannot decrypt the stored grant", async () => {
    vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", "");
    await expect(disconnectIfConnection()).rejects.toMatchObject({ code: "configuration" });
    expect(mocks.revoke).not.toHaveBeenCalled(); expect(row.update).not.toHaveBeenCalled();
    expect(mocks.clearCache).not.toHaveBeenCalled();
  });
  it.each([
    { label: "local", value: "" },
    { label: "configured revocation", value: "https://api.infiniteflight.com/supported-test-revoke" },
  ])("idempotently handles a missing connection in $label mode", async ({ value }) => {
    vi.stubEnv("IF_LIVE_REVOCATION_URL", value);
    mocks.connection.findByPk.mockResolvedValue(null);
    await expect(disconnectIfConnection()).resolves.toEqual({ revocation: "local_only" });
    expect(mocks.connection.findByPk).toHaveBeenCalledWith(1, { transaction, lock: "UPDATE" });
    expect(mocks.revoke).not.toHaveBeenCalled(); expect(mocks.clearCache).toHaveBeenCalledOnce();
  });
  it("does not claim provider revocation when no credentials remain", async () => {
    Object.assign(row, { access_token_encrypted: null, refresh_token_encrypted: null, expires_at: null, state: "disconnected" });
    await expect(disconnectIfConnection()).resolves.toEqual({ revocation: "local_only" });
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(mocks.clearCache).toHaveBeenCalledOnce();
  });
});
