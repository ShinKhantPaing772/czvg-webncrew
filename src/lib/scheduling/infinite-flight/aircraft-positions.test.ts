import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Op } from "sequelize";

const mocks = vi.hoisted(() => ({
  aircraft: { findAll: vi.fn(), create: vi.fn(), update: vi.fn(), destroy: vi.fn() },
  connection: { findByPk: vi.fn(), create: vi.fn(), update: vi.fn(), destroy: vi.fn() },
  authorization: vi.fn(), fleet: vi.fn(), position: vi.fn(), airports: vi.fn(), nearby: vi.fn(),
}));
vi.mock("@/lib/scheduling/models", () => ({ LiveAircraft: mocks.aircraft, IfLiveConnection: mocks.connection }));
vi.mock("./connection", () => ({ getIfAuthorizationSnapshot: mocks.authorization }));
vi.mock("./client", () => ({ getIfFleet: mocks.fleet, getIfPositionSnapshot: mocks.position, getIf3DAirportsSnapshot: mocks.airports }));
vi.mock("./position", () => ({ estimateNearbyIfAirport: mocks.nearby }));

import { IfLiveError } from "./config";
import { loadIfAircraftPositions } from "./aircraft-positions";

const NOW = Date.parse("2026-10-04T12:00:00Z");
const ORGANIZATION = "20000000-0000-0000-0000-000000000001";
const OTHER_ORGANIZATION = "20000000-0000-0000-0000-000000000002";
const remote = (id: number) => `10000000-0000-0000-0000-${String(id).padStart(12, "0")}`;
const safePosition = () => ({ state: 1, isOnGround: true, latitude: 43.6777, longitude: -79.6248, updatedAt: new Date(NOW - 86400_000).toISOString() });
const positionSnapshot = (expiresAt = NOW + 60_000) => ({ position: safePosition(), expiresAt });
let aircraft: Array<{ id: number; aircraft_id: number; if_aircraft_id: string | null }>;
let connection: Record<string, unknown>;

beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(NOW);
  aircraft = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, aircraft_id: 10, if_aircraft_id: remote(index + 1) }));
  connection = { state: "connected", organization_id: ORGANIZATION, access_token_encrypted: "private-stored-credential", connected_by: 9 };
  mocks.aircraft.findAll.mockImplementation(async () => aircraft.map(row => ({ ...row })));
  mocks.connection.findByPk.mockImplementation(async () => ({ ...connection }));
  mocks.authorization.mockResolvedValue({ token: "private-if-access-token", organizationId: ORGANIZATION, credential: "private-stored-credential", owner: 9 });
  mocks.fleet.mockImplementation(async () => aircraft.filter(row => row.if_aircraft_id).map(row => ({ id: row.if_aircraft_id, organizationId: ORGANIZATION, status: 0 })));
  mocks.position.mockImplementation(async () => positionSnapshot());
  mocks.airports.mockResolvedValue({ airports: [{ icao: "CYYZ", latitude: 43.6777, longitude: -79.6248 }], expiresAt: NOW + 60_000 });
  mocks.nearby.mockReturnValue({ icao: "CYYZ", distanceNm: 0.25 });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("temporary IF fleet position views", () => {
  it("resolves local bindings, uses one cached fleet read and returns only safe position/reference fields", async () => {
    mocks.position.mockResolvedValue({ ...positionSnapshot(), position: { ...safePosition(), id: "private-remote-id", token: "private-extra-token", flightPlan: "private-flight-plan" }, privateHeader: "private-header" });
    mocks.nearby.mockReturnValue({ icao: "CYYZ", distanceNm: 0.25, privateDirectoryData: "private-airport-data" });
    const result = await loadIfAircraftPositions([2, 1]);
    expect(result).toEqual({ aircraft: [2, 1].map(id => ({ id, position: safePosition(), nearbyAirport: { icao: "CYYZ", distanceNm: 0.25 } })),
      loadedAt: new Date(NOW).toISOString(), expiresAt: new Date(NOW + 60_000).toISOString() });
    expect(mocks.authorization).toHaveBeenCalledOnce();
    expect(mocks.fleet).toHaveBeenCalledWith("private-if-access-token", ORGANIZATION);
    expect(mocks.fleet).toHaveBeenCalledOnce(); expect(mocks.airports).toHaveBeenCalledOnce();
    expect(mocks.position).toHaveBeenCalledWith("private-if-access-token", remote(2));
    expect(mocks.position).toHaveBeenCalledWith("private-if-access-token", remote(1));
    expect(mocks.aircraft.findAll).toHaveBeenCalledWith({ where: { id: { [Op.in]: [2, 1] } }, attributes: ["id", "aircraft_id", "if_aircraft_id"], raw: true });
    expect(JSON.stringify(result)).not.toContain("private-");
    for (const table of [mocks.aircraft, mocks.connection]) for (const operation of [table.create, table.update, table.destroy]) expect(operation).not.toHaveBeenCalled();
  });

  it("reads positions independently of publishing, identifier-retention flags, or flight schedules", async () => {
    vi.stubEnv("IF_LIVE_AUTO_PUBLISH_ENABLED", "false"); vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "false"); vi.stubEnv("IF_LIVE_REVOCATION_URL", "");
    const result = await loadIfAircraftPositions([1]);
    expect(result.aircraft[0].position).toEqual(safePosition()); expect(result).not.toHaveProperty("schedules");
  });

  it.each([[], [1, 1], [0], [-1], [1.1], [2_147_483_648], [1, 2, 3, 4, 5, 6, 7]].map(ids => ({ ids })))("rejects invalid direct input $ids before DB or IF access", async ({ ids }) => {
    await expect(loadIfAircraftPositions(ids)).rejects.toMatchObject({ code: "validation", status: 400 });
    expect(mocks.aircraft.findAll).not.toHaveBeenCalled(); expect(mocks.authorization).not.toHaveBeenCalled();
  });

  it("keeps missing and denied positions separate from successful aircraft", async () => {
    mocks.position.mockImplementation(async (_token, id: string) => {
      if (id === remote(1)) throw new IfLiveError("private-missing-details", "position_unavailable", 409);
      if (id === remote(2)) throw new IfLiveError("private-denial-details", "forbidden", 403);
      return positionSnapshot();
    });
    const result = await loadIfAircraftPositions([1, 2, 3]);
    expect(result.aircraft[0]).toMatchObject({ id: 1, position: null, nearbyAirport: null, code: "position_unavailable" });
    expect(result.aircraft[1]).toMatchObject({ id: 2, position: null, nearbyAirport: null, code: "forbidden" });
    expect(result.aircraft[2]).toEqual({ id: 3, position: safePosition(), nearbyAirport: { icao: "CYYZ", distanceNm: 0.25 } });
    expect(JSON.stringify(result)).not.toContain("private-");
  });

  it("returns per-row missing/unlinked/foreign membership failures without accessing those remote positions", async () => {
    aircraft = aircraft.filter(row => row.id !== 1); aircraft[0].if_aircraft_id = null;
    const foreign = { id: remote(3), organizationId: OTHER_ORGANIZATION };
    mocks.fleet.mockResolvedValue([foreign, { id: remote(4), organizationId: ORGANIZATION }]);
    const result = await loadIfAircraftPositions([1, 2, 3, 4]);
    expect(result.aircraft.map(row => row.code)).toEqual(["not_found", "binding", "binding", undefined]);
    expect(mocks.position).toHaveBeenCalledOnce(); expect(mocks.position).toHaveBeenCalledWith("private-if-access-token", remote(4));
  });

  it("does no IF authorization or fleet reads when every requested aircraft is missing or unlinked", async () => {
    aircraft = [{ id: 1, aircraft_id: 10, if_aircraft_id: null }];
    mocks.authorization.mockRejectedValue(new Error("IF is offline"));
    const result = await loadIfAircraftPositions([1, 2]);
    expect(result.aircraft.map(row => row.code)).toEqual(["binding", "not_found"]);
    expect(mocks.authorization).not.toHaveBeenCalled(); expect(mocks.fleet).not.toHaveBeenCalled(); expect(mocks.position).not.toHaveBeenCalled();
    expect(Date.parse(result.expiresAt)).toBeGreaterThan(Date.parse(result.loadedAt));
  });

  it("rejects ambiguous fleet membership before reading a position", async () => {
    mocks.fleet.mockResolvedValue([{ id: remote(1), organizationId: ORGANIZATION }, { id: remote(1), organizationId: ORGANIZATION }]);
    expect((await loadIfAircraftPositions([1])).aircraft[0]).toMatchObject({ position: null, code: "binding" });
    expect(mocks.position).not.toHaveBeenCalled();
  });

  it("keeps a retry hint safe while suppressing unexpected provider messages", async () => {
    mocks.position.mockRejectedValue(new IfLiveError("private-rate-limit-token", "rate_limited", 429, 120));
    const result = await loadIfAircraftPositions([1]);
    expect(result.aircraft[0]).toMatchObject({ position: null, code: "rate_limited", retryAfterSeconds: 120 });
    expect(JSON.stringify(result)).not.toContain("private-");
    mocks.position.mockRejectedValue(new Error("private-network-token"));
    expect((await loadIfAircraftPositions([1])).aircraft[0]).toMatchObject({ position: null, code: "unavailable" });
  });

  it("does not expose unrecognized error codes or excessive retry delays", async () => {
    mocks.position.mockRejectedValue(new IfLiveError("private-error", "private-code", 502, 1_000_000));
    const result = await loadIfAircraftPositions([1]);
    expect(result.aircraft[0]).toMatchObject({ code: "unavailable", retryAfterSeconds: 3600 });
    expect(JSON.stringify(result)).not.toContain("private-");
  });

  it("uses the earliest actual cache expiry instead of extending an older position by 60 seconds", async () => {
    mocks.position.mockImplementation(async (_token, id: string) => positionSnapshot(id === remote(1) ? NOW + 8_000 : NOW + 60_000));
    mocks.airports.mockImplementation(async () => { vi.setSystemTime(NOW + 1_000); return { airports: [], expiresAt: NOW + 60_000 }; });
    mocks.nearby.mockReturnValue(null);
    const result = await loadIfAircraftPositions([1, 2]);
    expect(result.loadedAt).toBe(new Date(NOW + 1_000).toISOString());
    expect(result.expiresAt).toBe(new Date(NOW + 8_000).toISOString());
  });

  it("preserves parked aircraft positions whose original IF update is old", async () => {
    expect((await loadIfAircraftPositions([1])).aircraft[0].position?.updatedAt).toBe(new Date(NOW - 86400_000).toISOString());
  });

  it("clears a position that expires during directory work without expiring the remaining valid rows", async () => {
    mocks.position.mockImplementation(async (_token, id: string) => positionSnapshot(id === remote(1) ? NOW + 8_000 : NOW + 60_000));
    mocks.airports.mockImplementation(async () => { vi.setSystemTime(NOW + 10_000); return { airports: [], expiresAt: NOW + 60_000 }; });
    const result = await loadIfAircraftPositions([1, 2]);
    expect(result.aircraft[0]).toMatchObject({ id: 1, position: null, nearbyAirport: null, code: "unavailable", retryAfterSeconds: 1, error: expect.stringContaining("position expired") });
    expect(result.aircraft[1].position).toEqual(safePosition());
    expect(result.expiresAt).toBe(new Date(NOW + 60_000).toISOString());
    expect(Date.parse(result.expiresAt)).toBeGreaterThan(Date.parse(result.loadedAt));
  });

  it("returns a future error-view expiry when all cached positions expire during revalidation", async () => {
    mocks.position.mockResolvedValue(positionSnapshot(NOW + 1_000));
    mocks.connection.findByPk.mockImplementation(async () => { vi.setSystemTime(NOW + 2_000); return { ...connection }; });
    const result = await loadIfAircraftPositions([1]);
    expect(result.aircraft[0]).toMatchObject({ position: null, nearbyAirport: null, code: "unavailable" });
    expect(result.expiresAt).toBe(new Date(NOW + 62_000).toISOString());
  });

  it("limits derived airport references to the cached directory's earlier original expiry", async () => {
    mocks.airports.mockResolvedValue({ airports: [], expiresAt: NOW + 8_000 });
    const result = await loadIfAircraftPositions([1]);
    expect(result.aircraft[0].nearbyAirport).toEqual({ icao: "CYYZ", distanceNm: 0.25 });
    expect(result.aircraft[0].position).toEqual(safePosition());
    expect(result.expiresAt).toBe(new Date(NOW + 8_000).toISOString());
  });

  it("clears expired directory references while preserving valid position coordinates and their original expiry", async () => {
    mocks.airports.mockResolvedValue({ airports: [], expiresAt: NOW + 1_000 });
    mocks.connection.findByPk.mockImplementation(async () => { vi.setSystemTime(NOW + 2_000); return { ...connection }; });
    const result = await loadIfAircraftPositions([1]);
    expect(result.aircraft[0]).toEqual({ id: 1, position: safePosition(), nearbyAirport: null });
    expect(result.airportLookupError).toContain("airport reference expired");
    expect(result.expiresAt).toBe(new Date(NOW + 60_000).toISOString());
  });

  it("does not shorten coordinate expiry when no nearby airport estimate was derived", async () => {
    mocks.airports.mockResolvedValue({ airports: [], expiresAt: NOW + 1_000 }); mocks.nearby.mockReturnValue(null);
    const result = await loadIfAircraftPositions([1]);
    expect(result.aircraft[0].nearbyAirport).toBeNull();
    expect(result.expiresAt).toBe(new Date(NOW + 60_000).toISOString());
  });

  it("does not hide coordinates when the optional airport directory fails", async () => {
    mocks.airports.mockRejectedValue(new Error("private-key-or-directory-error"));
    const result = await loadIfAircraftPositions([1]);
    expect(result.aircraft[0]).toEqual({ id: 1, position: safePosition(), nearbyAirport: null });
    expect(result.airportLookupError).toContain("nearby airport reference is unavailable");
    expect(JSON.stringify(result)).not.toContain("private-");
  });

  it("skips airport lookups for airborne or unavailable positions", async () => {
    mocks.position.mockResolvedValue({ ...positionSnapshot(), position: { ...safePosition(), isOnGround: false } });
    expect((await loadIfAircraftPositions([1])).aircraft[0].nearbyAirport).toBeNull();
    expect(mocks.airports).not.toHaveBeenCalled();
    mocks.position.mockRejectedValue(new IfLiveError("", "position_unavailable", 409));
    expect((await loadIfAircraftPositions([1])).aircraft[0].position).toBeNull();
    expect(mocks.airports).not.toHaveBeenCalled();
  });

  it("limits simultaneous remote position requests to three for a six-aircraft batch", async () => {
    const completions: Array<() => void> = [];
    let active = 0; let peak = 0;
    mocks.position.mockImplementation(() => new Promise(resolve => {
      active += 1; peak = Math.max(peak, active);
      completions.push(() => { active -= 1; resolve(positionSnapshot()); });
    }));
    const promise = loadIfAircraftPositions([1, 2, 3, 4, 5, 6]);
    for (let tick = 0; tick < 15; tick += 1) await Promise.resolve();
    expect(completions).toHaveLength(3); expect(peak).toBe(3);
    completions.slice(0, 3).forEach(complete => complete());
    for (let tick = 0; tick < 15; tick += 1) await Promise.resolve();
    expect(completions).toHaveLength(6); expect(peak).toBe(3);
    completions.slice(3).forEach(complete => complete());
    expect((await promise).aircraft.every(row => row.position !== null)).toBe(true);
  });

  it("stops starting new upstream reads once the overall request deadline is exhausted", async () => {
    mocks.position.mockImplementation(async () => { vi.setSystemTime(NOW + 20_001); return positionSnapshot(NOW + 60_000); });
    const result = await loadIfAircraftPositions([1, 2, 3, 4, 5, 6]);
    expect(mocks.position).toHaveBeenCalledOnce();
    expect(result.aircraft[0].position).toEqual(safePosition());
    expect(result.aircraft.slice(1).every(row => row.code === "budget")).toBe(true);
    expect(mocks.airports).not.toHaveBeenCalled();
  });

  it.each([
    { key: "state", value: "disconnected" }, { key: "access_token_encrypted", value: "changed-credential" },
    { key: "connected_by", value: 10 }, { key: "organization_id", value: OTHER_ORGANIZATION },
  ])("rejects a changed IF connection $key after upstream reads", async ({ key, value }) => {
    mocks.position.mockImplementation(async () => { connection[key] = value; return positionSnapshot(); });
    await expect(loadIfAircraftPositions([1])).rejects.toMatchObject({ code: "connection_changed", status: 409 });
  });

  it("rejects a changed local IF binding after reads", async () => {
    mocks.position.mockImplementation(async () => { aircraft[0].if_aircraft_id = remote(99); return positionSnapshot(); });
    await expect(loadIfAircraftPositions([1])).rejects.toMatchObject({ code: "connection_changed", status: 409 });
  });

  it("rejects a changed local catalog type during airport lookup", async () => {
    mocks.airports.mockImplementation(async () => { aircraft[0].aircraft_id += 1; return { airports: [], expiresAt: NOW + 60_000 }; });
    await expect(loadIfAircraftPositions([1])).rejects.toMatchObject({ code: "connection_changed", status: 409 });
  });

  it("rejects a deleted local aircraft or missing IF connection before returning cached coordinates", async () => {
    mocks.position.mockImplementation(async () => { aircraft = []; return positionSnapshot(); });
    await expect(loadIfAircraftPositions([1])).rejects.toMatchObject({ code: "connection_changed", status: 409 });
  });

  it("requires a saved organization and does not fetch positions from an arbitrary organization", async () => {
    mocks.authorization.mockResolvedValue({ token: "private-token", organizationId: null });
    await expect(loadIfAircraftPositions([1])).rejects.toMatchObject({ code: "binding", status: 409 });
    expect(mocks.fleet).not.toHaveBeenCalled(); expect(mocks.position).not.toHaveBeenCalled();
  });
});
