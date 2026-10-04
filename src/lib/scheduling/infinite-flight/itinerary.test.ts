import { describe, expect, it } from "vitest";
import { assertIfItinerary, orderedIfSchedules, sameIfSchedule, scheduleMarker } from "./itinerary";
import { buildIfPayload } from "./sync";
import type { IfSchedule } from "./types";

const [PUBLIC, NEXT, OTHER, REMOTE] = [1, 2, 3, 4].map(value => `10000000-0000-0000-0000-${String(value).padStart(12, "0")}`);
const local = { id: 1, public_id: PUBLIC, callsign: null, departure: "CYYZ", arrival: "CYVR", scheduled_departure: null, scheduled_arrival: null, notes: null, queue_order: 1, status: "approved" };
const desired = buildIfPayload(local, [{ userId: OTHER, role: 0 }]);
const untimed: IfSchedule = { ...desired.schedule, id: REMOTE, aircraftId: OTHER, organizationId: OTHER, scheduledDepartureUtc: "0001-01-01T00:00:00", scheduledArrivalUtc: "0001-01-01T00:00:00", status: 1, crew: desired.crew, sequence: 1 };

describe("IF itinerary ordering with optional planned times", () => {
  it("compares IF's sentinel or absent times with an authored untimed schedule without fabricating dates", () => {
    expect(desired.schedule).not.toHaveProperty("scheduledDepartureUtc"); expect(desired.schedule).not.toHaveProperty("scheduledArrivalUtc");
    expect(sameIfSchedule(untimed, desired.schedule)).toBe(true);
    expect(sameIfSchedule({ ...untimed, scheduledDepartureUtc: null, scheduledArrivalUtc: null }, desired.schedule)).toBe(true);
  });
  it("rejects an invalid local time pair instead of silently omitting its invalid dates", () => {
    expect(() => buildIfPayload({ ...local, scheduled_departure: new Date("invalid"), scheduled_arrival: new Date("invalid") }, desired.crew)).toThrow("cannot be represented");
    expect(() => buildIfPayload({ ...local, scheduled_departure: new Date("2026-10-06T10:00:00Z") }, desired.crew)).toThrow("cannot be represented");
  });
  it("uses explicit IF sequence for untimed legs even if the provider array is returned in another order", () => {
    const next = { ...untimed, id: NEXT, originIcao: "CYVR", destinationIcao: "KSEA", briefing: "External", sequence: 2 };
    expect(assertIfItinerary({ schedules: [next, untimed], localFlights: [{ ...local, if_schedule_id: REMOTE, last_published_payload: desired }] }).map(row => row.origin)).toEqual(["CYYZ", "CYVR"]);
  });
  it("does not let repeated historical sequence values block the current active queue", () => {
    const history = [9, 11].map(status => ({ ...untimed, id: status === 9 ? NEXT : OTHER, sequence: 0, status }));
    expect(orderedIfSchedules([...history, untimed])[0].id).toBe(REMOTE);
  });
  it("rejects duplicate active sequence numbers instead of inventing an itinerary", () => {
    expect(() => orderedIfSchedules([untimed, { ...untimed, id: NEXT }])).toThrow("duplicate schedule sequence");
  });
  it("appends a new untimed local leg after an existing untimed external flight", () => {
    const external = { ...untimed, briefing: "External", originIcao: "KJFK", destinationIcao: "CYYZ" };
    const itinerary = assertIfItinerary({ schedules: [external], localFlights: [local], target: { publicId: PUBLIC, desired: desired.schedule }, requirePublishedPredecessors: true });
    expect(itinerary.map(row => row.origin)).toEqual(["KJFK", "CYYZ"]); expect(itinerary.every(row => row.departure === null && row.arrival === null)).toBe(true);
  });
  it("keeps airport continuity strict when times are absent", () => {
    const external = { ...untimed, briefing: "External", originIcao: "KJFK", destinationIcao: "KBOS" };
    expect(() => assertIfItinerary({ schedules: [external], localFlights: [local], target: { publicId: PUBLIC, desired: desired.schedule } })).toThrow("discontinuous");
  });
  it("requires the preceding untimed local flight to publish before the next leg", () => {
    const second = { ...local, id: 2, public_id: NEXT, queue_order: 2, departure: "CYVR", arrival: "KSEA" };
    const payload = buildIfPayload(second, desired.crew);
    expect(() => assertIfItinerary({ schedules: [], localFlights: [local, second], target: { publicId: NEXT, desired: payload.schedule }, requirePublishedPredecessors: true })).toThrow("preceding local flights");
  });
  it("uses local queue positions and still rejects time intervals that run backward across that route", () => {
    const first = { ...local, scheduled_departure: "2026-10-06T14:00:00Z", scheduled_arrival: "2026-10-06T15:00:00Z" };
    const second = { ...local, public_id: NEXT, queue_order: 2, departure: "CYVR", arrival: "KSEA", scheduled_departure: "2026-10-06T10:00:00Z", scheduled_arrival: "2026-10-06T11:00:00Z" };
    expect(() => assertIfItinerary({ schedules: [], localFlights: [first, second] })).toThrow("overlaps");
  });
  it("checks timed overlaps even with an untimed intermediate leg", () => {
    const first = { ...untimed, briefing: "External", scheduledDepartureUtc: "2026-10-06T10:00:00Z", scheduledArrivalUtc: "2026-10-06T12:00:00Z" };
    const bridge = { ...untimed, id: NEXT, sequence: 2, briefing: "External", originIcao: "CYVR", destinationIcao: "KSEA" };
    const third = { ...first, id: PUBLIC, sequence: 3, originIcao: "KSEA", destinationIcao: "KLAX", scheduledDepartureUtc: "2026-10-06T11:00:00Z", scheduledArrivalUtc: "2026-10-06T15:00:00Z" };
    expect(() => assertIfItinerary({ schedules: [first, bridge, third] })).toThrow("overlaps");
  });
  it.each([
    { scheduledDepartureUtc: null, scheduledArrivalUtc: "2026-10-06T15:00:00Z" },
    { scheduledDepartureUtc: "invalid", scheduledArrivalUtc: "invalid" },
  ])("rejects incomplete or malformed active time intervals: %j", changes => {
    expect(() => assertIfItinerary({ schedules: [{ ...untimed, ...changes }] })).toThrow("invalid route or time interval");
  });
  it("retains marker and crew conflict checks for an untimed managed reservation", () => {
    const changed = { ...untimed, briefing: scheduleMarker(PUBLIC), crew: [] };
    expect(() => assertIfItinerary({ schedules: [changed], localFlights: [{ ...local, if_schedule_id: REMOTE, last_published_payload: desired }] })).toThrow("changed outside");
  });
});
