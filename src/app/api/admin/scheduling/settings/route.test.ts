import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), read: vi.fn(), change: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ requirePermission: mocks.authorize }));
vi.mock("@/lib/scheduling/settings", () => ({ getSchedulingSettings: mocks.read, changeSchedulingSettings: mocks.change }));
vi.mock("@/lib/scheduling/service", () => ({ schedulingFailure: (error: { status?: number; message: string }) => ({ status: error.status ?? 500, error: error.message }) }));
import { GET, PATCH } from "./route";
const request = (body?: unknown) => new Request("https://ifczvg.com/api/admin/scheduling/settings", body === undefined ? {} : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  mocks.authorize.mockReset().mockResolvedValue({ ok: true, user: { id: 9 } });
  mocks.read.mockReset().mockResolvedValue({ allowUnpublishedIfStarts: false });
  mocks.change.mockReset().mockResolvedValue({ allowUnpublishedIfStarts: true });
});

describe("admin scheduling start-policy API", () => {
  it.each([GET, PATCH])("denies pilots before reading or changing admin policy", async handler => {
    mocks.authorize.mockResolvedValue({ ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) });
    const input = request({ allowUnpublishedIfStarts: true });
    expect((await handler(input)).status).toBe(403);
    expect(mocks.authorize).toHaveBeenCalledWith(input, "scheduling");
    expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.change).not.toHaveBeenCalled();
  });

  it("returns the default policy without caching", async () => {
    const response = await GET(request());
    expect(await response.json()).toEqual({ success: true, data: { allowUnpublishedIfStarts: false } });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("uses the authenticated admin rather than any client identity", async () => {
    const response = await PATCH(request({ allowUnpublishedIfStarts: true }));
    expect(mocks.change).toHaveBeenCalledWith(9, { allowUnpublishedIfStarts: true });
    expect(await response.json()).toEqual({ success: true, data: { allowUnpublishedIfStarts: true } });
  });

  it("surfaces server-side permission removal during a mutation", async () => {
    mocks.change.mockRejectedValue({ status: 403, message: "An active scheduling administrator is required" });
    expect((await PATCH(request({ allowUnpublishedIfStarts: true }))).status).toBe(403);
  });

  it("rejects malformed JSON before changing settings", async () => {
    const response = await PATCH(new Request("https://ifczvg.com/api/admin/scheduling/settings", { method: "PATCH", body: "{" }));
    expect(response.status).toBe(400); expect(mocks.change).not.toHaveBeenCalled();
  });
});
