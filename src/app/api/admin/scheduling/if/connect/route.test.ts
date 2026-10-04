import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), findConnection: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ requirePermission: mocks.authorize }));
vi.mock("@/lib/scheduling/models", () => ({ IfLiveConnection: { findByPk: mocks.findConnection } }));

import { POST } from "./route";
import { readIfAuthorizationState } from "@/lib/scheduling/infinite-flight/oauth";

beforeEach(() => {
  vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "true");
  vi.stubEnv("IF_LIVE_CLIENT_ID", "test-client");
  vi.stubEnv("IF_LIVE_CLIENT_SECRET", "test-client-secret");
  vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("IF_LIVE_REVOCATION_URL", "");
  vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://ifczvg.com/oauth/callback");
  mocks.authorize.mockReset().mockResolvedValue({ ok: true, user: { id: 42 }, token: "site-token" });
  mocks.findConnection.mockReset().mockResolvedValue(null);
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("IF authorization initiation", () => {
  it.each(["https://ifczvg.com/oauth/callback", "https://internal.ifczvg.com/oauth/callback"])("binds state and cookie to the registered callback %s without a revocation URL", async callback => {
    vi.stubEnv("IF_LIVE_REDIRECT_URI", callback);
    const response = await POST(new Request(`${new URL(callback).origin}/api/admin/scheduling/if/connect`, { method: "POST" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    const authorization = new URL(body.authorizationUrl);
    const cookie = response.cookies.get("wnc_if_oauth_state")!;
    expect(readIfAuthorizationState(cookie.value, authorization.searchParams.get("state")!)).toMatchObject({ pilotId: 42, redirectUri: callback });
    expect(authorization.searchParams.get("redirect_uri")).toBe(callback);
    expect(cookie.path).toBe("/oauth/callback");
    expect(cookie.httpOnly).toBe(true); expect(cookie.secure).toBe(true); expect(cookie.sameSite).toBe("lax");
    expect(body.authorizationUrl).not.toContain("site-token");
    expect(body.authorizationUrl).not.toContain("test-client-secret");
  });
  it("rejects initiation from another origin without issuing OAuth state", async () => {
    const response = await POST(new Request("https://other.example/api/admin/scheduling/if/connect", { method: "POST" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "callback_origin" });
    expect(response.cookies.get("wnc_if_oauth_state")).toBeUndefined();
    expect(mocks.findConnection).not.toHaveBeenCalled();
  });
  it("preserves the legacy callback cookie path", async () => {
    vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://ifczvg.com/api/admin/scheduling/if/callback");
    const response = await POST(new Request("https://ifczvg.com/api/admin/scheduling/if/connect", { method: "POST" }));
    expect(response.cookies.get("wnc_if_oauth_state")?.path).toBe("/api/admin/scheduling/if/callback");
  });
  it("denies unauthorized callers before reading connection state", async () => {
    mocks.authorize.mockResolvedValue({ ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) });
    expect((await POST(new Request("https://ifczvg.com/api/admin/scheduling/if/connect", { method: "POST" }))).status).toBe(403);
    expect(mocks.findConnection).not.toHaveBeenCalled();
  });
});
