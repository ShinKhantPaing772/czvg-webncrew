import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aircraft: { findByPk: vi.fn(), update: vi.fn(), create: vi.fn() },
  connection: { findByPk: vi.fn(), update: vi.fn() },
  flights: { findAll: vi.fn() },
  authorization: vi.fn(), fleet: vi.fn(), schedules: vi.fn(), position: vi.fn(),
}));
vi.mock("@/lib/scheduling/models", () => ({ LiveAircraft: mocks.aircraft, IfLiveConnection: mocks.connection, LiveFlight: mocks.flights }));
vi.mock("./connection", () => ({ getIfAuthorizationSnapshot: mocks.authorization }));
vi.mock("./client", () => ({ getIfFleet: mocks.fleet, getIfSchedules: mocks.schedules, getIfPosition: mocks.position }));

import { loadIfAircraftSchedules, localAircraftIdFromRequest } from "./aircraft-schedules";
import { ifRequestTimeoutMs } from "./request-budget";

const ORG = "10000000-0000-0000-0000-000000000001";
const REMOTE = "10000000-0000-0000-0000-000000000002";
const OTHER = "10000000-0000-0000-0000-000000000003";
const SCHEDULE = "10000000-0000-0000-0000-000000000004";
const CREW = "10000000-0000-0000-0000-000000000005";
const NOW = Date.parse("2026-10-04T10:00:00Z");
const aircraft = { id: 7, aircraft_id: 10, if_aircraft_id: REMOTE };
const connection = { state: "connected", access_token_encrypted: "encrypted-token", connected_by: 42, organization_id: ORG };
const schedule = {
  id: SCHEDULE, aircraftId: REMOTE, organizationId: ORG, callsign: "WNC1", flightType: 1, originIcao: "CYYZ", destinationIcao: "CYVR",
  scheduledDepartureUtc: "2026-10-05T10:00:00Z", scheduledArrivalUtc: "2026-10-05T15:00:00Z", status: 1,
  crew: [{ userId: CREW, role: 0, privateCrewField: "private-crew" }],
  briefing: "private-briefing", flightPlan: "private-plan", unknownProviderField: "private-provider", sequence: 1,
};

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW); vi.resetAllMocks();
  vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "true"); vi.stubEnv("IF_LIVE_AUTO_PUBLISH_ENABLED", "false");
  vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "false"); vi.stubEnv("IF_LIVE_CLIENT_ID", "client");
  vi.stubEnv("IF_LIVE_CLIENT_SECRET", "private-secret"); vi.stubEnv("IF_LIVE_REVOCATION_URL", "");
  vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://example.com/oauth/callback");
  vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  mocks.aircraft.findByPk.mockResolvedValue({ ...aircraft });
  mocks.connection.findByPk.mockResolvedValue({ ...connection });
  mocks.authorization.mockResolvedValue({ token: "private-token", credential: connection.access_token_encrypted, owner: 42, organizationId: ORG });
  mocks.fleet.mockResolvedValue([{ id: REMOTE, organizationId: ORG }]);
  mocks.schedules.mockResolvedValue([schedule]);
  mocks.flights.findAll.mockResolvedValue([]);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("temporary schedules for a locally bound aircraft", () => {
  it("reads fresh schedules without publishing permission, allowlists the response, and writes nothing", async () => {
    const result = await loadIfAircraftSchedules(7);
    expect(result).toEqual({
      schedules: [{ id: SCHEDULE, callsign: "WNC1", flightType: 1, originIcao: "CYYZ", destinationIcao: "CYVR", scheduledDepartureUtc: "2026-10-05T10:00:00.000Z",
        scheduledArrivalUtc: "2026-10-05T15:00:00.000Z", status: 1, crew: [{ userId: CREW, role: 0 }], sequence: 1,
        fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/), managedFlightId: null, editable: false, editDisabledReason: expect.stringContaining("administrator"),
        matchable: false, matchDisabledReason: expect.stringContaining("administrator") }],
      loadedAt: "2026-10-04T10:00:00.000Z", expiresAt: "2026-10-04T10:01:00.000Z", publishingReady: false,
      publishingDisabledReasons: expect.arrayContaining(["Automatic IF publishing is disabled", "Durable IF mapping retention has not been authorized"]),
      matchingReady: false,
    });
    expect(mocks.fleet).toHaveBeenCalledWith("private-token", ORG, { fresh: true });
    expect(mocks.schedules).toHaveBeenCalledWith("private-token", REMOTE, { fresh: true });
    expect(mocks.fleet.mock.invocationCallOrder[0]).toBeLessThan(mocks.schedules.mock.invocationCallOrder[0]);
    expect(mocks.authorization).toHaveBeenCalledOnce(); expect(mocks.aircraft.findByPk).toHaveBeenCalledTimes(2);
    expect(mocks.position).not.toHaveBeenCalled();
    expect(mocks.aircraft.update).not.toHaveBeenCalled(); expect(mocks.aircraft.create).not.toHaveBeenCalled(); expect(mocks.connection.update).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/private-|encrypted-token|organizationId|aircraftId/);
  });

  it("returns an empty schedule list without requesting IF position", async () => {
    mocks.schedules.mockResolvedValue([]);
    await expect(loadIfAircraftSchedules(7)).resolves.toMatchObject({ schedules: [] });
    expect(mocks.position).not.toHaveBeenCalled();
  });

  it("permits manual matching for administrators with durable binding permission while automatic publishing is off", async () => {
    vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "true");
    const admin = await loadIfAircraftSchedules(7, { admin: true });
    expect(admin).toMatchObject({ publishingReady: false, matchingReady: true, schedules: [{ matchable: true }] });
    const pilot = await loadIfAircraftSchedules(7);
    expect(pilot).toMatchObject({ matchingReady: false, schedules: [{ matchable: false }] });
  });

  it("exposes a retry for an approved local flight awaiting uncertain match confirmation", async () => {
    vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "true");
    mocks.flights.findAll.mockResolvedValue([{ id: 23, public_id: OTHER, if_schedule_id: SCHEDULE, status: "approved", publishing_state: "reconciliation" }]);
    const result = await loadIfAircraftSchedules(7, { admin: true });
    expect(result.schedules[0]).toMatchObject({ managedFlightId: 23, editable: false, matchable: true });
    expect(mocks.flights.findAll).toHaveBeenCalledWith(expect.objectContaining({ attributes: expect.arrayContaining(["publishing_state"]) }));
  });

  it.each([undefined, { admin: false }, { admin: true }])("applies role-specific visibility while preserving app ownership for %j", async options => {
    const id = (value: number) => `10000000-0000-0000-0000-${String(value).padStart(12, "0")}`;
    const externalCancelled = { ...schedule, id: id(6), status: 9 };
    const localCancelled = { ...schedule, id: id(7), status: 1 };
    const localRejected = { ...schedule, id: id(8), status: 1, briefing: `[WNC schedule:${id(18)}]` };
    const localApproved = { ...schedule, id: id(9), status: 1 };
    const arrived = { ...schedule, id: id(10), status: 11 };
    const allSchedules = [schedule, externalCancelled, localCancelled, localRejected, localApproved, arrived];
    mocks.schedules.mockResolvedValue(allSchedules);
    mocks.flights.findAll.mockResolvedValue([
      { id: 27, public_id: id(17), if_schedule_id: localCancelled.id, status: "cancelled" },
      { id: 28, public_id: id(18), if_schedule_id: null, status: "rejected" },
      { id: 29, public_id: id(19), if_schedule_id: localApproved.id, status: "approved" },
    ]);

    const result = await loadIfAircraftSchedules(7, options);
    expect(result.schedules.map(row => row.id)).toEqual(options?.admin ? allSchedules.map(row => row.id) : [schedule.id, localApproved.id, arrived.id]);
    expect(result.schedules.find(row => row.id === localApproved.id)).toMatchObject({ managedFlightId: 29, editable: false });
    if (options?.admin) {
      expect(result.schedules.find(row => row.id === localCancelled.id)).toMatchObject({ managedFlightId: 27, editable: false, editDisabledReason: expect.stringContaining("local scheduling") });
      expect(result.schedules.find(row => row.id === localRejected.id)).toMatchObject({ managedFlightId: 28, editable: false, editDisabledReason: expect.stringContaining("local scheduling") });
      expect(result.schedules.find(row => row.id === externalCancelled.id)).toMatchObject({ managedFlightId: null, editable: false, editDisabledReason: "Cancelled flights are locked" });
    }
    expect(mocks.aircraft.update).not.toHaveBeenCalled();
    expect(mocks.connection.update).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, NaN, Infinity, 2_147_483_648])("rejects invalid local ID %s before reading", async id => {
    await expect(loadIfAircraftSchedules(id)).rejects.toMatchObject({ code: "validation", status: 400 });
    expect(mocks.aircraft.findByPk).not.toHaveBeenCalled(); expect(mocks.authorization).not.toHaveBeenCalled();
  });

  it.each([null, { ...aircraft, if_aircraft_id: null }, { ...aircraft, if_aircraft_id: "invalid" }])("rejects missing or unbound local aircraft %j before accessing IF", async row => {
    mocks.aircraft.findByPk.mockResolvedValue(row);
    await expect(loadIfAircraftSchedules(7)).rejects.toMatchObject({ status: row ? 409 : 404 });
    expect(mocks.authorization).not.toHaveBeenCalled(); expect(mocks.fleet).not.toHaveBeenCalled();
  });

  it("requires a saved organization and never accepts a caller-selected IF organization", async () => {
    mocks.authorization.mockResolvedValue({ token: "private-token", credential: "encrypted-token", owner: 42, organizationId: null });
    await expect(loadIfAircraftSchedules(7)).rejects.toMatchObject({ code: "binding", status: 409 });
    expect(mocks.fleet).not.toHaveBeenCalled(); expect(mocks.schedules).not.toHaveBeenCalled();
  });

  it.each([{ fleet: [] }, { fleet: [{ id: REMOTE, organizationId: OTHER }] }, { fleet: [{ id: REMOTE, organizationId: ORG }, { id: REMOTE, organizationId: ORG }] }])("checks exact membership before reading another aircraft's schedules: %j", async ({ fleet }) => {
    mocks.fleet.mockResolvedValue(fleet);
    await expect(loadIfAircraftSchedules(7)).rejects.toMatchObject({ code: "binding", status: 409 });
    expect(mocks.schedules).not.toHaveBeenCalled();
  });

  it.each([{ aircraftId: OTHER }, { organizationId: OTHER }, { organizationId: undefined }])("rejects a mismatched schedule response: %j", async change => {
    mocks.schedules.mockResolvedValue([{ ...schedule, ...change }]);
    await expect(loadIfAircraftSchedules(7)).rejects.toMatchObject({ code: "invalid_response", status: 502 });
  });

  it.each([null, { ...aircraft, if_aircraft_id: null }, { ...aircraft, if_aircraft_id: OTHER }, { ...aircraft, aircraft_id: 11 }])("rejects a local binding/type change during the IF read: %j", async changed => {
    mocks.aircraft.findByPk.mockResolvedValueOnce(aircraft).mockResolvedValueOnce(changed);
    await expect(loadIfAircraftSchedules(7)).rejects.toMatchObject({ code: "connection_changed", status: 409 });
  });

  it.each([null, { ...connection, state: "disconnected" }, { ...connection, access_token_encrypted: "new-token" },
    { ...connection, connected_by: 43 }, { ...connection, organization_id: OTHER }])("rejects changed connection context during the IF read: %j", async changed => {
    mocks.connection.findByPk.mockResolvedValue(changed);
    await expect(loadIfAircraftSchedules(7)).rejects.toMatchObject({ code: "connection_changed", status: 409 });
  });

  it("shares a 20-second deadline across provider reads", async () => {
    mocks.fleet.mockImplementation(async () => {
      expect(ifRequestTimeoutMs()).toBe(15_000); vi.setSystemTime(NOW + 16_000); return [{ id: REMOTE, organizationId: ORG }];
    });
    mocks.schedules.mockImplementation(async () => { expect(ifRequestTimeoutMs()).toBe(4_000); return []; });
    await expect(loadIfAircraftSchedules(7)).resolves.toMatchObject({ schedules: [], loadedAt: "2026-10-04T10:00:16.000Z" });
  });

  it("does not return a snapshot when the full read exceeds its deadline", async () => {
    mocks.schedules.mockImplementation(async () => { vi.setSystemTime(NOW + 20_001); return []; });
    await expect(loadIfAircraftSchedules(7)).rejects.toMatchObject({ code: "budget", status: 503 });
  });
});

describe("local aircraft query boundary", () => {
  it.each(["", "?aircraftId=0", "?aircraftId=-1", "?aircraftId=1.5", "?aircraftId=1e2", "?aircraftId=01", "?aircraftId=2147483648",
    "?aircraftId=7&aircraftId=8", "?aircraftId=7&organizationId=" + ORG, "?aircraftId=7&fresh=true"])('rejects unsupported query "%s"', query => {
    expect(() => localAircraftIdFromRequest(new Request("https://example.com/schedules" + query))).toThrow("Select one valid local aircraft");
  });
  it("accepts exactly one local ID", () => {
    expect(localAircraftIdFromRequest(new Request("https://example.com/schedules?aircraftId=7"))).toBe(7);
  });
});
