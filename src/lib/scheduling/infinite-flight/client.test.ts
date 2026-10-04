import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearIfLiveCache, createIfSchedule, getIf3DAirports, getIf3DAirportsSnapshot, getIfAirport, getIfContentDirectory, getIfFleet, getIfOrganizations, getIfPosition, getIfPositionSnapshot, getIfSchedules, reorderIfSchedule } from "./client";
import { IF_LIVE_CACHE_MS } from "./config";

const UUID = "10000000-0000-0000-0000-000000000001";
const CONTENT_ID = "10000000-0000-0000-0000-000000000002";
const fleet = [{ id: UUID, organizationId: UUID, aircraftId: CONTENT_ID, registration: "IF-DVKH", isFleetActiveSlot: true, status: 0, visibility: 1 }];
const position = { id: UUID, state: 1, isOnGround: true, latitude: 43.6777, longitude: -79.6248, updatedAt: "2026-10-03T10:00:00Z" };
const scheduleBody = { callsign: "WNC1", flightType: 1 as const, originIcao: "CYYZ", destinationIcao: "CYVR", scheduledDepartureUtc: "2026-10-03T10:00:00Z", scheduledArrivalUtc: "2026-10-03T15:00:00Z", briefing: null, flightPlan: null };
beforeEach(() => { vi.useFakeTimers(); clearIfLiveCache(); });
afterEach(() => { clearIfLiveCache(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function success() { return Response.json({ errorCode: 0, result: [{ id: UUID, name: "Our org" }] }); }
function result(value: unknown) { return Response.json({ errorCode: 0, result: value }); }

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
    await expect(createIfSchedule("secret", UUID, scheduleBody)).rejects.toMatchObject({ uncertainWrite: true });
  });
  it("disables redirect following for authenticated reads and writes", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(success()).mockResolvedValueOnce(Response.json({ errorCode: 0, result: true })); vi.stubGlobal("fetch", fetcher);
    await getIfOrganizations("secret"); await reorderIfSchedule("secret", UUID, UUID, null);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "GET", redirect: "error" });
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "PUT", redirect: "error" });
  });
  it.each([false, true])("rejects a redirected response before parsing its body (mutation: %s)", async mutation => {
    const response = success(); Object.defineProperty(response, "redirected", { value: true });
    const parse = vi.spyOn(response, "json"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const request = mutation ? createIfSchedule("secret", UUID, scheduleBody) : getIfOrganizations("secret");
    await expect(request).rejects.toMatchObject({ code: "redirect", status: 502, uncertainWrite: mutation, message: "Infinite Flight returned an unexpected redirect" });
    expect(parse).not.toHaveBeenCalled();
  });
  it.each([{ status: 302, mutation: false }, { status: 307, mutation: true }])("rejects unexpected HTTP $status without blindly retrying writes", async ({ status, mutation }) => {
    const response = new Response("Provider response must remain private", { status }); const parse = vi.spyOn(response, "json");
    const fetcher = vi.fn().mockResolvedValue(response); vi.stubGlobal("fetch", fetcher);
    const request = mutation ? createIfSchedule("secret", UUID, scheduleBody) : getIfOrganizations("secret");
    await expect(request).rejects.toMatchObject({ code: "redirect", status: 502, uncertainWrite: mutation, message: "Infinite Flight returned an unexpected redirect" });
    expect(parse).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledOnce();
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
  it.each([{ aircraftId: CONTENT_ID, organizationId: UUID }, { aircraftId: UUID, organizationId: undefined }, { aircraftId: UUID, organizationId: 123 }])("rejects mismatched or malformed schedule ownership: %j", change => {
    vi.stubGlobal("fetch", vi.fn(async () => result([{ ...scheduleBody, id: UUID, status: 1, crew: [], ...change }])));
    return expect(getIfSchedules("secret", UUID, { fresh: true })).rejects.toMatchObject({ code: "invalid_response", status: 502 });
  });
  it.each([
    { scheduledDepartureUtc: "0001-01-01T00:00:00", scheduledArrivalUtc: "0001-01-01T00:00:00" },
    { scheduledDepartureUtc: "0001-01-01T00:00:00.0000000Z", scheduledArrivalUtc: "0001-01-01T00:00:00.0000000Z" },
    { scheduledDepartureUtc: null, scheduledArrivalUtc: null },
    { scheduledDepartureUtc: undefined, scheduledArrivalUtc: undefined },
  ])("reads genuine unset IF times without inventing a scheduled interval: %j", async change => {
    vi.stubGlobal("fetch", vi.fn(async () => result([{ ...scheduleBody, id: UUID, aircraftId: UUID, organizationId: UUID, status: 1, crew: [], ...change }])));
    await expect(getIfSchedules("secret", UUID, { fresh: true })).resolves.toHaveLength(1);
  });
  it.each(["not-a-time", "2026-10-06T10:00:00", 123])("rejects malformed provider times instead of treating them as untimed: %j", async scheduledDepartureUtc => {
    vi.stubGlobal("fetch", vi.fn(async () => result([{ ...scheduleBody, id: UUID, aircraftId: UUID, organizationId: UUID, status: 1, crew: [], scheduledDepartureUtc }])));
    await expect(getIfSchedules("secret", UUID, { fresh: true })).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("bypasses an earlier fleet cache for binding and departure checks", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(result(fleet)).mockResolvedValueOnce(result([{ ...fleet[0], isFleetActiveSlot: false }])); vi.stubGlobal("fetch", fetcher);
    await getIfFleet("secret", UUID); await getIfFleet("secret", UUID); expect(fetcher).toHaveBeenCalledOnce();
    await expect(getIfFleet("secret", UUID, { fresh: true })).resolves.toMatchObject([{ isFleetActiveSlot: false }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("bypasses cached position coordinates for departure checks", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(result(position)).mockResolvedValueOnce(result({ ...position, latitude: 49.1967, longitude: -123.1815 })); vi.stubGlobal("fetch", fetcher);
    await getIfPosition("secret", UUID); await getIfPosition("secret", UUID); expect(fetcher).toHaveBeenCalledOnce();
    await expect(getIfPosition("secret", UUID, { fresh: true })).resolves.toMatchObject({ latitude: 49.1967 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not share a pending UI fleet read with a fresh binding check", async () => {
    let completeUi!: (value: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { completeUi = resolve; })).mockResolvedValueOnce(result([{ ...fleet[0], isFleetActiveSlot: false }])); vi.stubGlobal("fetch", fetcher);
    const uiRead = getIfFleet("secret", UUID);
    await expect(getIfFleet("secret", UUID, { fresh: true })).resolves.toMatchObject([{ isFleetActiveSlot: false }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    completeUi(result(fleet)); await uiRead;
  });
  it.each([{ ...fleet[0], aircraftId: "invalid" }, { ...fleet[0], status: 9 }])("rejects invalid fleet content and record status", async invalid => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(result([invalid])));
    await expect(getIfFleet("secret", UUID, { fresh: true })).rejects.toMatchObject({ code: "invalid_response", status: 502 });
  });
  it("fails closed with guidance when IF has no persisted position", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(result(null)));
    await expect(getIfPosition("secret", UUID, { fresh: true })).rejects.toMatchObject({ code: "position_unavailable", status: 409, message: expect.stringContaining("review its location in IF") });
  });
  it.each([
    { ...position, id: CONTENT_ID }, { ...position, state: 6 }, { ...position, isOnGround: undefined },
    { ...position, latitude: 91 }, { ...position, longitude: -181 }, { ...position, updatedAt: "invalid" },
  ])("rejects mismatched or invalid IF persisted position", async invalid => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(result(invalid)));
    await expect(getIfPosition("secret", UUID, { fresh: true })).rejects.toMatchObject({ code: "invalid_response", status: 502 });
  });
  it.each([false, 0, "", [], undefined].map(value => ({ value })))("treats malformed falsy position $value as an invalid response rather than a missing position", async ({ value }) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(result(value)));
    await expect(getIfPositionSnapshot("secret", UUID)).rejects.toMatchObject({ code: "invalid_response", status: 502 });
  });
  it.each(["2026-10-03T10:00:00", "2026-10-03", "10/03/2026 10:00:00Z", "2026-10-03T10:00:00+99:99"])("rejects a position timestamp without a supported explicit timezone: %s", async updatedAt => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(result({ ...position, updatedAt })));
    await expect(getIfPosition("secret", UUID)).rejects.toMatchObject({ code: "invalid_response", status: 502 });
  });
  it.each(["2026-10-03T10:00:00Z", "2026-10-03T10:00:00.1234567Z", "2026-10-03T10:00:00+02:00"])("accepts the documented position date-time with an explicit timezone: %s", async updatedAt => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(result({ ...position, updatedAt })));
    await expect(getIfPositionSnapshot("secret", UUID)).resolves.toMatchObject({ position: { updatedAt } });
  });
  it("returns only allowlisted position fields without restarting an existing cache lifetime", async () => {
    const originalTime = Date.now();
    const fetcher = vi.fn(async () => result({ ...position, lastPilotId: CONTENT_ID, lastPilotUsername: "Private username", altitude: 0, providerMetadata: "Private metadata" })); vi.stubGlobal("fetch", fetcher);
    const first = await getIfPositionSnapshot("secret", UUID);
    expect(first).toEqual({ position: { state: 1, isOnGround: true, latitude: position.latitude, longitude: position.longitude, updatedAt: position.updatedAt }, expiresAt: originalTime + IF_LIVE_CACHE_MS });
    vi.advanceTimersByTime(40_000);
    const later = await getIfPositionSnapshot("secret", UUID);
    expect(later.expiresAt).toBe(first.expiresAt); expect(later.expiresAt - Date.now()).toBe(20_000);
    expect(fetcher).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(20_001);
    const renewed = await getIfPositionSnapshot("secret", UUID);
    expect(renewed.expiresAt).toBe(Date.now() + IF_LIVE_CACHE_MS); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("refreshes a requested position without reusing an earlier cached or pending UI result", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(result(position)).mockResolvedValueOnce(result({ ...position, latitude: 49.1967, lastPilotUsername: "Private" })); vi.stubGlobal("fetch", fetcher);
    await getIfPositionSnapshot("secret", UUID);
    vi.advanceTimersByTime(10_000);
    const refreshed = await getIfPositionSnapshot("secret", UUID, { fresh: true });
    expect(refreshed).toEqual({ position: { state: 1, isOnGround: true, latitude: 49.1967, longitude: position.longitude, updatedAt: position.updatedAt }, expiresAt: Date.now() + IF_LIVE_CACHE_MS });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not cache an invalid or missing position before a successful retry", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(result({ ...position, latitude: 91 })).mockResolvedValueOnce(result(null)).mockResolvedValueOnce(result(position)); vi.stubGlobal("fetch", fetcher);
    await expect(getIfPositionSnapshot("secret", UUID)).rejects.toMatchObject({ code: "invalid_response" });
    await expect(getIfPositionSnapshot("secret", UUID)).rejects.toMatchObject({ code: "position_unavailable" });
    await expect(getIfPositionSnapshot("secret", UUID)).resolves.toMatchObject({ position: { latitude: position.latitude } });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("evicts a cached position if a caller corrupted its validated fields", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(result(position)).mockResolvedValueOnce(result({ ...position, latitude: 49.1967 })); vi.stubGlobal("fetch", fetcher);
    const cached = await getIfPosition("secret", UUID); cached.latitude = 91;
    await expect(getIfPositionSnapshot("secret", UUID)).rejects.toMatchObject({ code: "invalid_response" });
    await expect(getIfPositionSnapshot("secret", UUID)).resolves.toMatchObject({ position: { latitude: 49.1967 } });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("deduplicates position snapshots for a credential but never shares them with another credential", async () => {
    const fetcher = vi.fn(async () => result(position)); vi.stubGlobal("fetch", fetcher);
    const [left, right] = await Promise.all([getIfPositionSnapshot("one", UUID), getIfPositionSnapshot("one", UUID)]);
    expect(left).toEqual(right); expect(fetcher).toHaveBeenCalledOnce();
    await getIfPositionSnapshot("two", UUID); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("uses the documented reorder payload and invalidates the cached queue", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ errorCode: 0, result: [] })).mockResolvedValueOnce(Response.json({ errorCode: 0, result: true })).mockResolvedValueOnce(Response.json({ errorCode: 0, result: [] })); vi.stubGlobal("fetch", fetcher);
    await getIfSchedules("secret", UUID); await reorderIfSchedule("secret", UUID, UUID, null); await getIfSchedules("secret", UUID);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1][0]).toBe(`https://api.infiniteflight.com/public/v3/live/aircraft/${UUID}/schedules/reorder`);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "PUT", body: JSON.stringify({ scheduleId: UUID, afterId: null }) });
  });
});

describe("IF content and airport directory transport", () => {
  it("loads only documented 3D-airport coordinates with the server API key and a temporary cache", async () => {
    vi.stubEnv("IF_API", "directory-secret");
    const airports = [{ icao: "cyyz", latitude: position.latitude, longitude: position.longitude, name: "Unpersisted airport name", country: { name: "Canada" }, has3dBuildings: true }];
    const fetcher = vi.fn(async (_url: string, _options: RequestInit) => result(airports)); vi.stubGlobal("fetch", fetcher);
    await expect(getIf3DAirports()).resolves.toEqual([{ icao: "CYYZ", latitude: position.latitude, longitude: position.longitude }]);
    expect(fetcher.mock.calls[0][0]).toBe("https://api.infiniteflight.com/public/v2/airports");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "GET", redirect: "error", headers: { Authorization: "Bearer directory-secret" } });
    await getIf3DAirports(); expect(fetcher).toHaveBeenCalledOnce();
    await getIf3DAirports({ fresh: true }); expect(fetcher).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(IF_LIVE_CACHE_MS + 1); await getIf3DAirports(); expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("preserves the original 3D directory expiry when a later position view uses its cached airport estimates", async () => {
    vi.stubEnv("IF_API", "directory-secret");
    const originalTime = Date.now();
    const fetcher = vi.fn(async () => result([{ icao: "CYYZ", latitude: position.latitude, longitude: position.longitude, name: "Unpersisted metadata" }])); vi.stubGlobal("fetch", fetcher);
    const airports = await getIf3DAirports();
    vi.advanceTimersByTime(50_000);
    const snapshot = await getIf3DAirportsSnapshot();
    expect(snapshot).toEqual({ airports, expiresAt: originalTime + IF_LIVE_CACHE_MS });
    expect(snapshot.expiresAt - Date.now()).toBe(10_000); expect(fetcher).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10_001);
    const renewed = await getIf3DAirportsSnapshot();
    expect(renewed.expiresAt).toBe(Date.now() + IF_LIVE_CACHE_MS); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([
    null, {}, [{ icao: "../airport", latitude: 0, longitude: 0 }], [{ icao: "CYYZ", latitude: "43.67", longitude: 0 }],
    [{ icao: "CYYZ", latitude: 91, longitude: 0 }], [{ icao: "CYYZ", latitude: 0, longitude: -181 }],
    [{ icao: "CYYZ", latitude: 0, longitude: 0 }, { icao: "cyyz", latitude: 1, longitude: 1 }],
  ].map(value => ({ value })))("rejects malformed or ambiguous 3D-airport directory responses: $value", async ({ value }) => {
    vi.stubEnv("IF_API", "directory-secret"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(result(value)));
    await expect(getIf3DAirports()).rejects.toMatchObject({ code: "invalid_response", status: 502 });
  });
  it("permits an empty 3D directory and retries after an invalid directory without retaining it", async () => {
    vi.stubEnv("IF_API", "directory-secret");
    const fetcher = vi.fn().mockResolvedValueOnce(result([{ icao: "CYYZ", latitude: 91, longitude: 0 }])).mockResolvedValueOnce(result([])); vi.stubGlobal("fetch", fetcher);
    await expect(getIf3DAirports()).rejects.toMatchObject({ code: "invalid_response" });
    await expect(getIf3DAirports()).resolves.toEqual([]); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("reports missing or rejected directory access without leaking provider content or treating it as OAuth expiry", async () => {
    vi.stubEnv("IF_API", ""); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(getIf3DAirports()).rejects.toMatchObject({ code: "configuration", message: expect.stringContaining("IF_API") }); expect(fetcher).not.toHaveBeenCalled();
    vi.stubEnv("IF_API", "directory-secret"); fetcher.mockResolvedValue(new Response("Private provider data directory-secret", { status: 403 }));
    await expect(getIf3DAirports()).rejects.toMatchObject({ code: "configuration", status: 403, uncertainWrite: false, message: expect.stringContaining("server's IF_API key") });
  });
  it("reads documented content directories with only the existing server API key", async () => {
    vi.stubEnv("IF_API", "directory-secret");
    const fetcher = vi.fn().mockResolvedValueOnce(result([{ id: CONTENT_ID, name: "Airbus A320" }])).mockResolvedValueOnce(result([{ id: UUID, aircraftID: CONTENT_ID, aircraftName: "Airbus A320", liveryName: "Our airline" }])); vi.stubGlobal("fetch", fetcher);
    await expect(getIfContentDirectory()).resolves.toMatchObject({ aircraft: [{ id: CONTENT_ID }], liveries: [{ aircraftID: CONTENT_ID }] });
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(["https://api.infiniteflight.com/public/v2/aircraft", "https://api.infiniteflight.com/public/v2/aircraft/liveries"]);
    for (const call of fetcher.mock.calls) expect(call[1]).toMatchObject({ method: "GET", redirect: "error", headers: { Authorization: "Bearer directory-secret" } });
    await getIfContentDirectory(); expect(fetcher).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(IF_LIVE_CACHE_MS + 1);
    fetcher.mockResolvedValueOnce(result([{ id: CONTENT_ID, name: "Airbus A320" }])).mockResolvedValueOnce(result([{ id: UUID, aircraftID: CONTENT_ID, aircraftName: "Airbus A320", liveryName: "Our airline" }]));
    await getIfContentDirectory(); expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("fails closed when a livery lacks a valid documented parent aircraft ID", async () => {
    vi.stubEnv("IF_API", "directory-secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(result([{ id: CONTENT_ID, name: "Airbus A320" }])).mockResolvedValueOnce(result([{ id: UUID, aircraftID: "invalid", aircraftName: "Airbus A320", liveryName: "Our airline" }])));
    await expect(getIfContentDirectory()).rejects.toMatchObject({ code: "invalid_response", status: 502 });
  });
  it("normalizes an airport code, validates coordinates, and bypasses a cached response when fresh", async () => {
    vi.stubEnv("IF_API", "directory-secret");
    const airport = { icao: "CYYZ", latitude: 43.6777, longitude: -79.6248, name: "Unpersisted metadata" };
    const fetcher = vi.fn().mockResolvedValueOnce(result(airport)).mockResolvedValueOnce(result({ ...airport, latitude: 43.678 })); vi.stubGlobal("fetch", fetcher);
    await expect(getIfAirport(" cyyz ")).resolves.toEqual({ icao: "CYYZ", latitude: 43.6777, longitude: -79.6248 });
    await getIfAirport("CYYZ"); expect(fetcher).toHaveBeenCalledOnce();
    await expect(getIfAirport("CYYZ", { fresh: true })).resolves.toMatchObject({ latitude: 43.678 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toBe("https://api.infiniteflight.com/public/v2/airport/CYYZ");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "GET", redirect: "error", headers: { Authorization: "Bearer directory-secret" } });
  });
  it.each([null, { icao: "CYVR", latitude: 43.6777, longitude: -79.6248 }, { icao: "CYYZ", latitude: "43.6777", longitude: -79.6248 }, { icao: "CYYZ", latitude: 91, longitude: -79.6248 }, { icao: "CYYZ", latitude: 43.6777, longitude: 181 }])("fails closed on missing, mismatched, or invalid airport coordinates", async invalid => {
    vi.stubEnv("IF_API", "directory-secret"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(result(invalid)));
    await expect(getIfAirport("CYYZ", { fresh: true })).rejects.toMatchObject({ code: "invalid_response", status: 502 });
  });
  it("provides an actionable missing server API key error without issuing requests", async () => {
    vi.stubEnv("IF_API", ""); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(getIfAirport("CYYZ", { fresh: true })).rejects.toMatchObject({ code: "configuration", status: 503, message: expect.stringContaining("IF_API") });
    await expect(getIfContentDirectory()).rejects.toMatchObject({ code: "configuration", status: 503 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([401, 403])("identifies a rejected server key without asking to reconnect OAuth (HTTP %s)", async status => {
    vi.stubEnv("IF_API", "directory-secret"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Private provider data directory-secret", { status })));
    await expect(getIfAirport("CYYZ", { fresh: true })).rejects.toMatchObject({ code: "configuration", status, uncertainWrite: false, message: expect.stringContaining("server's IF_API key") });
  });
  it("rejects an invalid airport path before requesting or exposing any key", async () => {
    vi.stubEnv("IF_API", "directory-secret"); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(getIfAirport("CYYZ?apikey=anything")).rejects.toMatchObject({ code: "validation", status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not expose an upstream airport error body or credential", async () => {
    vi.stubEnv("IF_API", "directory-secret"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Private provider data directory-secret", { status: 500 })));
    await expect(getIfAirport("CYYZ", { fresh: true })).rejects.toMatchObject({ status: 500, uncertainWrite: false, message: "Infinite Flight returned HTTP 500" });
  });
});
