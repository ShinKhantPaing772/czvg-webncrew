import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const worker = vi.hoisted(() => vi.fn());
vi.mock("@/lib/scheduling/infinite-flight/publisher", () => ({ runIfLivePublisher: worker }));
import { POST } from "./route";
const SECRET = "a".repeat(40);
beforeEach(() => { vi.stubEnv("IF_LIVE_WORKER_SECRET", SECRET); worker.mockResolvedValue({ processed: 0, disabled: true }); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("IF publishing worker authorization", () => {
  it("rejects calls without the internal secret and never starts publishing", async () => {
    const response = await POST(new Request("https://site.example/api/internal/if-live-publish", { method: "POST" }));
    expect(response.status).toBe(403); expect(worker).not.toHaveBeenCalled();
  });
  it("fails closed when the worker secret is absent or too short", async () => {
    vi.stubEnv("IF_LIVE_WORKER_SECRET", "short");
    expect((await POST(new Request("https://site.example/api/internal/if-live-publish", { method: "POST", headers: { Authorization: `Bearer ${SECRET}` } }))).status).toBe(503);
    expect(worker).not.toHaveBeenCalled();
  });
  it("accepts the configured internal bearer secret and keeps responses uncached", async () => {
    const response = await POST(new Request("https://site.example/api/internal/if-live-publish", { method: "POST", headers: { Authorization: `Bearer ${SECRET}` } }));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store"); expect(worker).toHaveBeenCalledOnce();
  });
});
