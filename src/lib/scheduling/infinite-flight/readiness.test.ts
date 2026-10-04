import { describe, expect, it } from "vitest";
import { assertIfDepartureReady } from "./readiness";
import { buildIfPayload } from "./sync";
import type { IfSchedule } from "./types";

const PUBLIC_ID = "10000000-0000-0000-0000-000000000001";
const AIRCRAFT_ID = "20000000-0000-0000-0000-000000000002";
const ORGANIZATION_ID = "30000000-0000-0000-0000-000000000003";
const REMOTE_ID = "40000000-0000-0000-0000-000000000004";
const CAPTAIN_ID = "50000000-0000-0000-0000-000000000005";
const local = { id: 1, public_id: PUBLIC_ID, callsign: null, departure: "CYYZ", arrival: "KJFK", scheduled_departure: new Date("2026-10-03T10:00:00Z"), scheduled_arrival: new Date("2026-10-03T12:00:00Z"), notes: null };
const desired = buildIfPayload(local, [{ userId: CAPTAIN_ID, role: 0 }]);
const remote: IfSchedule = { ...desired.schedule, id: REMOTE_ID, aircraftId: AIRCRAFT_ID, organizationId: ORGANIZATION_ID, status: 1, crew: desired.crew };

function fixture() {
  return {
    publicId: PUBLIC_ID, remoteId: REMOTE_ID, aircraftId: AIRCRAFT_ID, organizationId: ORGANIZATION_ID,
    desired, schedules: [{ ...remote, crew: [...remote.crew] }],
    position: { id: AIRCRAFT_ID, state: 1, isOnGround: true, latitude: 43.6777, longitude: -79.6248, updatedAt: "2026-10-03T09:50:00Z" },
    airport: { icao: "CYYZ", latitude: 43.6777, longitude: -79.6248 },
    localFlights: [{ ...local, if_schedule_id: REMOTE_ID, last_published_payload: desired }],
  };
}

describe("fresh IF departure verification", () => {
  it("accepts the unchanged next schedule and crew at the confirmed departure airport", () => {
    expect(() => assertIfDepartureReady(fixture())).not.toThrow();
  });

  it.each([{ schedules: [] }, { schedules: [{ ...remote, briefing: "External booking" }] }])("rejects deleted or unmarked published reservations", ({ schedules }) => {
    expect(() => assertIfDepartureReady({ ...fixture(), schedules })).toThrow("missing or its reference changed");
  });

  it("rejects duplicate local markers rather than selecting one", () => {
    const input = fixture(); input.schedules.push({ ...remote, id: CAPTAIN_ID });
    expect(() => assertIfDepartureReady(input)).toThrow("missing or its reference changed");
  });

  it.each([6, 9, 11, 99])("rejects a reservation now in IF status %i", status => {
    const input = fixture(); input.schedules[0].status = status;
    expect(() => assertIfDepartureReady(input)).toThrow("no longer scheduled");
  });

  it.each([
    { destinationIcao: "KBOS" }, { callsign: "EXTERNAL" }, { scheduledDepartureUtc: "2026-10-03T10:10:00Z" },
    { crew: [] }, { crew: [{ userId: CAPTAIN_ID, role: 1 as const }] },
  ])("rejects schedule or crew edits after publication: %j", change => {
    const input = fixture(); Object.assign(input.schedules[0], change);
    expect(() => assertIfDepartureReady(input)).toThrow("schedule or crew changed");
  });

  it.each([{ aircraftId: CAPTAIN_ID }, { organizationId: CAPTAIN_ID }])("rejects mismatched reservation ownership: %j", change => {
    const input = fixture(); Object.assign(input.schedules[0], change);
    expect(() => assertIfDepartureReady(input)).toThrow("different aircraft or organization");
  });

  it("blocks a preceding IF reservation even after its planned arrival time", () => {
    const input = fixture(); input.schedules.unshift({ ...remote, id: CAPTAIN_ID, briefing: "External", originIcao: "CYYZ", destinationIcao: "CYYZ", scheduledDepartureUtc: "2026-10-03T06:00:00Z", scheduledArrivalUtc: "2026-10-03T08:00:00Z" });
    expect(() => assertIfDepartureReady(input)).toThrow("preceding IF reservation");
  });

  it.each([6, 99])("blocks a different active reservation status %i regardless of planned time", status => {
    const input = fixture(); input.schedules.push({ ...remote, id: CAPTAIN_ID, briefing: "External", status, originIcao: "KJFK", destinationIcao: "KBOS", scheduledDepartureUtc: "2026-10-03T14:00:00Z", scheduledArrivalUtc: "2026-10-03T15:00:00Z" });
    expect(() => assertIfDepartureReady(input)).toThrow("preceding IF reservation");
  });

  it("ignores terminal historical reservations ahead of the target", () => {
    const input = fixture(); input.schedules.unshift({ ...remote, id: CAPTAIN_ID, briefing: "External", status: 9 });
    expect(() => assertIfDepartureReady(input)).not.toThrow();
  });

  it("checks a future external leg's origin before starting", () => {
    const input = fixture(); input.schedules.push({ ...remote, id: CAPTAIN_ID, briefing: "External", originIcao: "KBOS", destinationIcao: "EGLL", scheduledDepartureUtc: "2026-10-03T14:00:00Z", scheduledArrivalUtc: "2026-10-03T19:00:00Z" });
    expect(() => assertIfDepartureReady(input)).toThrow();
  });

  it("waits for a cancelled future owned reservation to be removed", () => {
    const next = { ...local, id: 2, public_id: CAPTAIN_ID, departure: "KJFK", arrival: "KBOS", scheduled_departure: new Date("2026-10-03T14:00:00Z"), scheduled_arrival: new Date("2026-10-03T15:00:00Z") };
    const payload = buildIfPayload(next, desired.crew);
    const input = fixture();
    input.schedules.push({ ...remote, ...payload.schedule, id: CAPTAIN_ID });
    input.localFlights.push({ ...next, if_schedule_id: CAPTAIN_ID, last_published_payload: payload, status: "cancelled" } as typeof input.localFlights[number]);
    expect(() => assertIfDepartureReady(input)).toThrow("pending owned IF reservations");
  });

  it.each([
    { state: 2, isOnGround: false }, { state: 5, isOnGround: true }, { id: CAPTAIN_ID },
  ])("rejects an unavailable or different persistent aircraft: %j", change => {
    const input = fixture(); Object.assign(input.position, change);
    expect(() => assertIfDepartureReady(input)).toThrow("on the ground and available");
  });

  it("rejects an aircraft that has flown to a different airport", () => {
    const input = fixture(); Object.assign(input.position, { latitude: 40.6413, longitude: -73.7781 });
    expect(() => assertIfDepartureReady(input)).toThrow("outside the 5 nautical mile vicinity of CYYZ");
  });

  it("allows an airport stand a short distance from the airport reference point", () => {
    const input = fixture(); input.position.latitude += 0.015;
    expect(() => assertIfDepartureReady(input)).not.toThrow();
  });

  it.each([{ icao: "KJFK" }, { latitude: Number.NaN }, { longitude: 200 }])("fails closed on an unverifiable airport position: %j", change => {
    const input = fixture(); Object.assign(input.airport, change);
    expect(() => assertIfDepartureReady(input)).toThrow("position could not be verified");
  });
});
