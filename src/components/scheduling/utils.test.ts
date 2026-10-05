import { describe, expect, it } from "vitest";
import { crewCount, departureForTime, formatIfScheduleTimeRange, formatRequestTime, formatUtc, hasIfScheduleTime, inputToIso, publishingLabel, utcInput } from "./utils";
import { LiveAircraft, ScheduledFlight } from "./types";

const aircraft: LiveAircraft = { id: 1, registration: "C-WNCB", aircraft_id: 10, current_airport: "CYYZ", active: true, name: "Boeing 737" };
const leg = (id: number, arrival: string, scheduledArrival: string, status: ScheduledFlight["status"] = "approved"): ScheduledFlight => ({
  id, public_id: String(id), live_aircraft_id: 1, captain_id: 1, departure: "CYYZ", arrival, queue_order: id,
  scheduled_departure: "2026-10-02T08:00:00Z", scheduled_arrival: scheduledArrival,
  status, revision: 1, captain: { id: 1, name: "Captain", callsign: "WNC1" }, members: [],
});

describe("scheduling display and UTC inputs", () => {
  it("keeps UTC form input and output independent of local timezone", () => {
    expect(utcInput("2026-10-02T09:30:00-04:00")).toBe("2026-10-02T13:30");
    expect(inputToIso("2026-10-02T13:30")).toBe("2026-10-02T13:30:00.000Z");
    expect(formatUtc("2026-10-02T09:30:00-04:00")).toContain("13:30 UTC");
    expect(inputToIso("")).toBeNull();
    expect(inputToIso("2026-02-30T13:30")).toBeNull();
    expect(formatUtc(null)).toBe("Time not specified");
    expect(formatUtc(undefined)).toBe("Time not specified");
    expect(formatUtc("invalid")).toBe("Time unavailable");
  });

  it("displays IF's year-one defaults as unspecified planned times", () => {
    expect(formatIfScheduleTimeRange("0001-01-01T00:00:00Z", "0001-01-01T00:00:00.000Z")).toBe("Planned times not specified");
    expect(formatIfScheduleTimeRange(null, undefined)).toBe("Planned times not specified");
    expect(formatIfScheduleTimeRange("invalid", "0001-01-01T00:00:00")).toBe("Planned times not specified");
    expect(hasIfScheduleTime("0001-01-01T00:00:00Z")).toBe(false);
    expect(formatIfScheduleTimeRange("2026-10-02T09:30:00-04:00", "2026-10-02T16:00:00Z")).toContain("13:30 UTC — 02 Oct 2026, 16:00 UTC");
    expect(formatIfScheduleTimeRange(null, "2026-10-02T16:00:00Z")).toBe("Departure time not specified — 02 Oct 2026, 16:00 UTC");
  });

  it("shows request timestamps in UTC with seconds without inventing missing or invalid times", () => {
    expect(formatRequestTime("2026-10-04T09:30:17-04:00")).toBe("04 Oct 2026, 13:30:17 UTC");
    expect(formatRequestTime(null)).toBe("Time not recorded");
    expect(formatRequestTime(undefined)).toBe("Time not recorded");
    expect(formatRequestTime("invalid")).toBe("Time unavailable");
  });

  it("appends new requests to the aircraft queue regardless of the entered clock time", () => {
    const flights = [
      { ...leg(3, "EGLL", "2026-10-02T19:00:00Z"), scheduled_departure: "2026-10-02T12:00:00Z" },
      leg(2, "KBOS", "2026-10-02T10:00:00Z", "pending"),
      leg(1, "KJFK", "2026-10-02T09:00:00Z"),
    ];
    expect(departureForTime(aircraft, flights, "2026-10-02T11:00:00Z")).toBe("EGLL");
    expect(departureForTime(aircraft, flights, "2026-10-02T08:00:00Z")).toBe("EGLL");
    expect(departureForTime(aircraft, flights, "2026-10-02T11:00:00Z", 1)).toBe("CYYZ");
  });

  it("keeps an amendment at its existing queue position", () => {
    const flights = [
      { ...leg(2, "WSSS", "2026-10-02T15:00:00Z"), scheduled_departure: "2026-10-02T10:00:00Z" },
      leg(1, "ZGGG", "2026-10-02T09:00:00Z"),
    ];
    expect(departureForTime(aircraft, flights, "2026-10-02T11:00:00Z")).toBe("WSSS");
    expect(departureForTime(aircraft, flights, "2026-10-02T11:00:00Z", 2)).toBe("ZGGG");
  });

  it("uses the server's ID ordering for predecessors with the same start time", () => {
    const flights = [leg(2, "WSSS", "2026-10-02T15:00:00Z"), leg(1, "ZGGG", "2026-10-02T09:00:00Z")];
    expect(departureForTime(aircraft, flights, "2026-10-02T11:00:00Z")).toBe("WSSS");
    expect(departureForTime(aircraft, flights, "2026-10-02T11:00:00Z", 2)).toBe("ZGGG");
    expect(publishingLabel("processing")).toBe("Publishing to IF");
  });

  it("leaves an unknown location available for manual entry", () => {
    expect(departureForTime({ ...aircraft, current_airport: null }, [], "2026-10-02T11:00:00Z")).toBe("");
  });

  it("counts the captain and approved members without counting requests", () => {
    const flight = leg(1, "KJFK", "2026-10-02T09:00:00Z");
    flight.members = [
      { id: 1, flight_id: 1, pilot_id: 2, status: "pending", pilot: { id: 2, name: "Pending", callsign: "WNC2" } },
      { id: 2, flight_id: 1, pilot_id: 3, status: "approved", pilot: { id: 3, name: "Crew", callsign: "WNC3" } },
      { id: 3, flight_id: 1, pilot_id: 4, status: "withdrawn", pilot: { id: 4, name: "Former crew", callsign: "WNC4" } },
    ];
    expect(crewCount(flight)).toBe(2);
  });
});
