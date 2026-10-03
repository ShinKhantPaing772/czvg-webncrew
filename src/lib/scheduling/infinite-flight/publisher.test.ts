import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  const model = () => ({ findByPk: vi.fn(), findAll: vi.fn(), findOne: vi.fn(), update: vi.fn(), count: vi.fn(), create: vi.fn() });
  return { transaction: vi.fn(), query: vi.fn(), liveFlight: model(), aircraft: model(), outbox: model(), connection: model(), member: model(), event: model(), pilot: model(), access: vi.fn(), token: vi.fn(), fleet: vi.fn(), schedules: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), putCrew: vi.fn(), removeCrew: vi.fn(), reorder: vi.fn() };
});
vi.mock("@/lib/database", () => ({ default: { transaction: mocks.transaction, query: mocks.query } }));
vi.mock("@/lib/models", () => ({ models: { Pilot: mocks.pilot } }));
vi.mock("@/lib/scheduling/models", () => ({ LiveFlight: mocks.liveFlight, LiveAircraft: mocks.aircraft, IfLiveOutbox: mocks.outbox, IfLiveConnection: mocks.connection, LiveFlightMember: mocks.member, LiveScheduleEvent: mocks.event }));
vi.mock("@/lib/scheduling/access", () => ({ canAccessLiveScheduling: mocks.access }));
vi.mock("./connection", () => ({ getIfAccessToken: mocks.token }));
vi.mock("./client", () => ({ getIfFleet: mocks.fleet, getIfSchedules: mocks.schedules, createIfSchedule: mocks.create, updateIfSchedule: mocks.update, deleteIfSchedule: mocks.remove, putIfCrew: mocks.putCrew, removeIfCrew: mocks.removeCrew, reorderIfSchedule: mocks.reorder }));
import { runIfLivePublisher } from "./publisher";
import { IfLiveError } from "./config";
import { buildIfPayload } from "./sync";

const UUID = "10000000-0000-0000-0000-000000000001";
const REMOTE_ID = "20000000-0000-0000-0000-000000000002";
let job: any; let flight: any; let lockTransaction: any;
beforeEach(() => {
  vi.stubEnv("IF_LIVE_PREVIEW_ENABLED", "true"); vi.stubEnv("IF_LIVE_AUTO_PUBLISH_ENABLED", "true"); vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "true");
  vi.stubEnv("IF_LIVE_CLIENT_ID", "ifc_test"); vi.stubEnv("IF_LIVE_CLIENT_SECRET", "client-secret"); vi.stubEnv("IF_LIVE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("IF_LIVE_REDIRECT_URI", "https://example.com/api/admin/scheduling/if/callback"); vi.stubEnv("IF_LIVE_REVOCATION_URL", "https://api.infiniteflight.com/supported-test-revoke");
  job = { id: 1, flight_id: 1, revision: 1, state: "queued", attempts: 0, next_attempt_at: new Date(0), get: vi.fn(() => "sync"), update: vi.fn(async function(this: any, values: any) { Object.assign(this, values); return this; }) };
  flight = { id: 1, public_id: UUID, live_aircraft_id: 7, captain_id: 42, callsign: null, departure: "CYYZ", arrival: "CYVR", scheduled_departure: new Date("2026-10-04T10:00:00Z"), scheduled_arrival: new Date("2026-10-04T15:00:00Z"), status: "approved", notes: null, revision: 1, published_revision: 0, publishing_state: "queued", if_schedule_id: null, last_published_payload: null, update: vi.fn(async function(this: any, values: any) { Object.assign(this, values); return this; }) };
  lockTransaction = { LOCK: { UPDATE: "UPDATE" }, commit: vi.fn(async () => undefined) };
  mocks.transaction.mockImplementation(async (callback: any) => callback ? callback(lockTransaction) : lockTransaction);
  mocks.query.mockImplementation(async (query: string) => query.includes("GET_LOCK") ? [{ acquired: 1 }] : query.includes("RELEASE_LOCK") ? [] : [{ name: "live_scheduling_mutex" }]);
  mocks.outbox.findAll.mockImplementation(async (options: any) => options.where.state === "processing" ? [] : [job]); mocks.outbox.findByPk.mockResolvedValue(job); mocks.outbox.count.mockResolvedValue(0); mocks.outbox.update.mockResolvedValue([1]);
  mocks.liveFlight.findByPk.mockImplementation(async () => flight); mocks.liveFlight.findAll.mockImplementation(async (options: any) => typeof options.where.status === "object" ? [{ public_id: UUID }] : []); mocks.liveFlight.update.mockResolvedValue([1]); mocks.member.findAll.mockResolvedValue([]);
  mocks.aircraft.findByPk.mockResolvedValue({ id: 7, if_aircraft_id: UUID, active: true }); mocks.connection.findByPk.mockResolvedValue({ organization_id: UUID, state: "connected" }); mocks.token.mockResolvedValue("if-access-token");
  mocks.pilot.findAll.mockResolvedValue([{ id: 42, ifuserid: UUID }]); mocks.access.mockResolvedValue(true);
  mocks.fleet.mockResolvedValue([{ id: UUID, organizationId: UUID, isFleetActiveSlot: true }]);
  const payload = buildIfPayload(flight, [{ userId: UUID, role: 0 }]); const remote = { ...payload.schedule, id: REMOTE_ID, aircraftId: UUID, organizationId: UUID, status: 1, crew: [] };
  mocks.schedules.mockResolvedValueOnce([]).mockResolvedValue([remote]);
  mocks.create.mockResolvedValue(remote); mocks.putCrew.mockResolvedValue({ ...remote, crew: payload.crew }); mocks.event.create.mockResolvedValue({});
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

describe("IF durable publishing worker", () => {
  it("does no queue or IF work until all integration gates are enabled", async () => {
    vi.stubEnv("IF_LIVE_DURABLE_BINDINGS_ALLOWED", "false");
    expect(await runIfLivePublisher()).toMatchObject({ disabled: true, processed: 0 }); expect(mocks.outbox.findAll).not.toHaveBeenCalled(); expect(mocks.token).not.toHaveBeenCalled();
  });
  it("checks award eligibility again before publishing approved crew", async () => {
    mocks.access.mockResolvedValue(false);
    const result = await runIfLivePublisher(); expect(result.states).toEqual({ failed: 1 }); expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.outbox.update).toHaveBeenCalledWith(expect.objectContaining({ state: "failed" }), expect.anything());
    expect(mocks.query.mock.calls.some(([query]) => String(query).includes("RELEASE_LOCK"))).toBe(true);
  });
  it("stops crew assignment when the award is revoked after schedule creation", async () => {
    mocks.create.mockImplementation(async () => {
      mocks.access.mockResolvedValue(false);
      const payload = buildIfPayload(flight, [{ userId: UUID, role: 0 }]);
      return { ...payload.schedule, id: REMOTE_ID, aircraftId: UUID, organizationId: UUID, status: 1, crew: [] };
    });
    const result = await runIfLivePublisher(); expect(result.states).toEqual({ failed: 1 }); expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.putCrew).not.toHaveBeenCalled(); expect(mocks.liveFlight.update).toHaveBeenCalledWith(expect.objectContaining({ if_schedule_id: REMOTE_ID }), expect.anything());
  });
  it("records an uncertain create in reconciliation and isolates stale failures", async () => {
    mocks.create.mockImplementation(async () => { flight = { ...flight, revision: 2 }; throw new IfLiveError("unknown outcome", "unavailable", 502, 60, true); });
    const result = await runIfLivePublisher(); expect(result.states).toEqual({ reconciliation: 1 });
    const failure = mocks.liveFlight.update.mock.calls.find(([values]) => values.publishing_state === "reconciliation");
    expect(failure?.[1].where).toEqual({ id: 1, revision: 1 }); expect(mocks.create).toHaveBeenCalledOnce();
  });
  it("preserves a completed older publish's binding while leaving a newer local revision queued", async () => {
    mocks.putCrew.mockImplementation(async () => {
      flight = { ...flight, revision: 2, published_revision: 5 };
      const payload = buildIfPayload(flight, [{ userId: UUID, role: 0 }]); return { ...payload.schedule, id: REMOTE_ID, status: 1, crew: payload.crew };
    });
    const result = await runIfLivePublisher(); expect(result.published).toBe(1);
    expect(flight.update).toHaveBeenCalledWith(expect.objectContaining({ published_revision: 5, if_schedule_id: REMOTE_ID, publishing_state: "queued" }), expect.anything());
  });
  it("rechecks the latest local revision immediately before a network mutation", async () => {
    mocks.schedules.mockReset();
    mocks.schedules.mockImplementation(async () => { flight = { ...flight, revision: 2 }; return []; });
    const result = await runIfLivePublisher(); expect(result.states).toEqual({ done: 1 }); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("moves a newly appended managed leg into the latest local queue order using fresh snapshots", async () => {
    const nextPublicId = "40000000-0000-0000-0000-000000000004";
    const nextRemoteId = "50000000-0000-0000-0000-000000000005";
    const payload = buildIfPayload(flight, [{ userId: UUID, role: 0 }]);
    const current = { ...payload.schedule, id: REMOTE_ID, aircraftId: UUID, organizationId: UUID, status: 1, crew: payload.crew };
    const nextPayload = buildIfPayload({ ...flight, id: 2, public_id: nextPublicId, departure: "CYVR", arrival: "CYYZ", scheduled_departure: new Date("2026-10-04T16:00:00Z"), scheduled_arrival: new Date("2026-10-04T21:00:00Z") }, payload.crew);
    const next = { ...current, ...nextPayload.schedule, id: nextRemoteId };
    mocks.schedules.mockReset().mockResolvedValueOnce([next]).mockResolvedValue([next, current]);
    mocks.liveFlight.findAll.mockImplementation(async (options: any) => typeof options.where.status === "object" ? [{ public_id: UUID }, { public_id: nextPublicId }] : []);
    const result = await runIfLivePublisher(); expect(result.published).toBe(1);
    expect(mocks.reorder).toHaveBeenCalledWith("if-access-token", UUID, REMOTE_ID, null);
    expect(mocks.schedules).toHaveBeenNthCalledWith(1, "if-access-token", UUID, { fresh: true });
    expect(mocks.schedules).toHaveBeenNthCalledWith(2, "if-access-token", UUID, { fresh: true });
  });
});
