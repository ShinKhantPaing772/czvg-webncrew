import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), disconnect: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ requirePermission: mocks.authorize }));
vi.mock("@/lib/scheduling/infinite-flight/connection", () => ({ disconnectIfConnection: mocks.disconnect }));

import { IfLiveError } from "@/lib/scheduling/infinite-flight/config";
import { POST } from "./route";

function request() { return new Request("https://example.com/api/admin/scheduling/if/disconnect", { method: "POST" }); }

beforeEach(() => {
  mocks.authorize.mockReset().mockResolvedValue({ ok: true, user: { id: 42 } });
  mocks.disconnect.mockReset().mockResolvedValue({ revocation: "revoked" });
});

describe("IF disconnect endpoint", () => {
  it.each([401, 403])("preserves authorization denial HTTP %i before disconnecting", async status => {
    const denied = Response.json({ success: false, error: "Denied" }, { status });
    mocks.authorize.mockResolvedValue({ ok: false, response: denied });
    const input = request();
    expect(await POST(input)).toBe(denied);
    expect(mocks.authorize).toHaveBeenCalledWith(input, "scheduling");
    expect(mocks.disconnect).not.toHaveBeenCalled();
  });

  it.each(["local_only", "revoked"] as const)("reports the actual %s disconnect result without caching it", async revocation => {
    mocks.disconnect.mockResolvedValue({ revocation });
    const input = request(); const response = await POST(input);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, revocation });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.authorize).toHaveBeenCalledWith(input, "scheduling");
    expect(mocks.disconnect).toHaveBeenCalledOnce();
  });

  it("reports an unconfirmed provider revocation as a failure rather than local-only success", async () => {
    mocks.disconnect.mockRejectedValue(new IfLiveError("IF revocation was not confirmed; retry disconnect", "revocation", 502));
    const response = await POST(request());
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ success: false, error: "IF revocation was not confirmed; retry disconnect", code: "revocation" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sanitizes unexpected disconnect failures without exposing database or credential details", async () => {
    mocks.disconnect.mockRejectedValue(new Error("Database query contained stored-secret"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.success).toBe(false); expect(body.error).toContain("IF scheduling integration is unavailable");
    expect(JSON.stringify(body)).not.toContain("stored-secret");
    expect(body).not.toHaveProperty("revocation");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
