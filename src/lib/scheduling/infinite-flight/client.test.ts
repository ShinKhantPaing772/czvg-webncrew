import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearIfLiveCache, createIfSchedule, getIfOrganizations, getIfSchedules, reorderIfSchedule } from "./client";
import { IF_LIVE_CACHE_MS } from "./config";

const UUID = "10000000-0000-0000-0000-000000000001";
beforeEach(() => { vi.useFakeTimers(); clearIfLiveCache(); });
afterEach(() => { clearIfLiveCache(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function success() { return Response.json({ errorCode: 0, result: [{ id: UUID, name: "Our org" }] }); }

describe("IF operational cache and transport", () => {
  it("deduplicates simultaneous reads and returns cached data until TTL expiry", async () => {
    const fetcher = vi.fn(async () => success()); vi.stubGlobal("fetch", fetcher);
    await Promise.all([getIfOrganizations("secret"), getIfOrganizations("secret")]); expect(fetcher).toHaveBeenCalledOnce();
    await getIfOrganizations("secret"); expect(fetcher).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(IF_LIVE_CACHE_MS + 1); await getIfOrganizations("secret"); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not reuse another credential's read result", async () => {
    const fetcher = vi.fn(async () => success()); vi.stubGlobal("fetch", fetcher);
    await getIfOrganizations("one"); await getIfOrganizations("two"); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not cache a failed read and honors upstream retry-after", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("", { status: 429, headers: { "Retry-After": "120" } })).mockResolvedValueOnce(success()); vi.stubGlobal("fetch", fetcher);
    await expect(getIfOrganizations("secret")).rejects.toMatchObject({ status: 429, retryAfterSeconds: 120 });
    await getIfOrganizations("secret"); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("labels a transport failure on POST as an unknown outcome", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    await expect(createIfSchedule("secret", UUID, { callsign: "WNC1", flightType: 1, originIcao: "CYYZ", destinationIcao: "CYVR", scheduledDepartureUtc: "2026-10-03T10:00:00Z", scheduledArrivalUtc: "2026-10-03T15:00:00Z", briefing: null, flightPlan: null })).rejects.toMatchObject({ uncertainWrite: true });
  });
  it("rejects an unexpected preview response shape", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ errorCode: 0, result: [{ id: UUID }] })));
    await expect(getIfOrganizations("secret")).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("bypasses an earlier UI cache for publishing snapshots", async () => {
    const fetcher = vi.fn(async () => Response.json({ errorCode: 0, result: [] })); vi.stubGlobal("fetch", fetcher);
    await getIfSchedules("secret", UUID); await getIfSchedules("secret", UUID); expect(fetcher).toHaveBeenCalledOnce();
    await getIfSchedules("secret", UUID, { fresh: true }); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("uses the documented reorder payload and invalidates the cached queue", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ errorCode: 0, result: [] })).mockResolvedValueOnce(Response.json({ errorCode: 0, result: true })).mockResolvedValueOnce(Response.json({ errorCode: 0, result: [] })); vi.stubGlobal("fetch", fetcher);
    await getIfSchedules("secret", UUID); await reorderIfSchedule("secret", UUID, UUID, null); await getIfSchedules("secret", UUID);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1][0]).toBe(`https://api.infiniteflight.com/public/v3/live/aircraft/${UUID}/schedules/reorder`);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "PUT", body: JSON.stringify({ scheduleId: UUID, afterId: null }) });
  });
});
