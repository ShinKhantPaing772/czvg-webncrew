// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/utils/api", () => ({ authFetch: mocks.fetch }));
import { AircraftSchedulesDialog } from "./aircraft-schedules";
import type { LiveAircraft, ScheduledFlight } from "./types";

const aircraft: LiveAircraft = { id: 12, registration: "C-TEST", aircraft_id: 1, current_airport: "CYYZ", active: true, if_aircraft_id: "remote-aircraft", name: "Airbus A320" };
const flight: ScheduledFlight = {
  id: 4, public_id: "local-flight", live_aircraft_id: 12, captain_id: 1, callsign: "LOCAL4",
  departure: "CYYZ", arrival: "KJFK", scheduled_departure: "2026-10-04T12:00:00Z", scheduled_arrival: "2026-10-04T14:00:00Z",
  status: "approved", revision: 2, if_schedule_id: "linked-schedule", publishing_state: "queued",
  captain: { id: 1, name: "Local Captain", callsign: "WNC1" }, members: [],
};
const remote = { id: "external-schedule", callsign: "EXTERNAL8", originIcao: "KJFK", destinationIcao: "EGLL", scheduledDepartureUtc: "2026-10-04T18:00:00Z", scheduledArrivalUtc: "2026-10-05T01:00:00Z", status: 8, crew: [{ userId: "if-user", role: 0 }], sequence: 1, fingerprint: "a".repeat(64), managedFlightId: null, editable: true };
function snapshot(overrides: Record<string, unknown> = {}) {
  return { schedules: [remote], loadedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(), publishingReady: true, publishingDisabledReasons: [], ...overrides };
}
let root: Root;
let container: HTMLDivElement;
const refresh = vi.fn(async () => {});
const select = vi.fn();
const close = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.fetch.mockImplementation(async () => Response.json({ success: true, data: snapshot() }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.resetAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});
async function render(admin = false, tail = aircraft, flights = [flight]) {
  await act(async () => root.render(<AircraftSchedulesDialog aircraft={tail} flights={flights} admin={admin} onClose={close} onSelect={select} onRefresh={refresh} />));
}
function button(label: string) {
  return Array.from(document.querySelectorAll("button")).find(item => item.textContent?.trim() === label)!;
}
async function load() { await act(async () => button("Load IF schedules").click()); }

describe("aircraft IF schedule view", () => {
  it("makes no automatic request on opening, elapsed time, focus, or visibility", async () => {
    vi.useFakeTimers();
    await render();
    await act(async () => {
      window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(120000);
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(button("Load IF schedules")).toBeDefined();
    await load();
    expect(mocks.fetch).toHaveBeenCalledWith("/api/scheduling/if/schedules?aircraftId=12", expect.objectContaining({ cache: "no-store" }));
    expect(document.body.textContent).toContain("EXTERNAL8 · KJFK → EGLL");
    expect(document.body.textContent).toContain("Delayed");
    expect(document.body.textContent).toContain("Captain assigned");
    expect(document.body.textContent).toContain("No local flight link");
    expect(button("Publish queued flights")).toBeUndefined();
    expect(button("Edit IF schedule")).toBeUndefined();
  });
  it("does not make an IF request for a local-only aircraft", async () => {
    await render(false, { ...aircraft, if_aircraft_id: null });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(button("Load IF schedules")).toBeUndefined();
    expect(document.body.textContent).toContain("This aircraft uses local scheduling");
    expect(document.body.textContent).toContain("LOCAL4 · CYYZ → KJFK");
  });
  it("routes a managed IF schedule to its local flight rather than direct IF edits", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ success: true, data: snapshot({ schedules: [{ ...remote, id: "linked-schedule", status: 1, managedFlightId: flight.id, editable: false }] }) }));
    await render(true); await load();
    expect(document.body.textContent).toContain("Linked to Crew Center");
    expect(button("Edit IF schedule")).toBeUndefined();
    await act(async () => button("View or amend local flight").click());
    expect(select).toHaveBeenCalledWith(flight);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("keeps schedules visible after sixty seconds, warns, and only reloads on request", async () => {
    vi.useFakeTimers();
    await render(); await load();
    await act(async () => vi.advanceTimersByTime(60000));
    expect(document.body.textContent).toContain("EXTERNAL8");
    expect(document.body.textContent).toContain("last refresh is over 60 seconds old");
    expect(document.body.textContent).toContain("Last successful refresh:");
    expect(document.body.textContent).toContain("LOCAL4");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    await act(async () => button("Refresh IF schedules").click());
    expect(document.body.textContent).not.toContain("last refresh is over 60 seconds old");
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it("preserves the last successful schedules when an upstream refresh fails", async () => {
    await render(); await load();
    mocks.fetch.mockResolvedValue(Response.json({ success: false, error: "IF is temporarily unavailable" }, { status: 503 }));
    await act(async () => button("Refresh IF schedules").click());
    expect(document.body.textContent).toContain("EXTERNAL8");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("IF is temporarily unavailable");
    expect(document.body.textContent).toContain("LOCAL4");
  });
  it.each([401, 403])("clears schedules on a denied refresh (%s) while keeping local flights available", async status => {
    await render(); await load();
    mocks.fetch.mockResolvedValue(Response.json({ success: false, error: "Live Pilot award required" }, { status }));
    await act(async () => button("Refresh IF schedules").click());
    expect(document.body.textContent).not.toContain("EXTERNAL8");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Live Pilot award required");
    expect(document.body.textContent).toContain("LOCAL4");
  });
  it("clears schedules when the server reports the aircraft binding changed", async () => {
    await render(); await load();
    mocks.fetch.mockResolvedValue(Response.json({ success: false, code: "connection_changed", error: "Aircraft link changed" }, { status: 409 }));
    await act(async () => button("Refresh IF schedules").click());
    expect(document.body.textContent).not.toContain("EXTERNAL8");
  });
  it("reports an empty IF itinerary without treating it as a failed read", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ success: true, data: snapshot({ schedules: [] }) }));
    await render(); await load();
    expect(document.body.textContent).toContain("No schedules returned by IF");
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });
  it("shows highest queue sequences first and never treats year-one defaults as real flight times", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ success: true, data: snapshot({ schedules: [
      { ...remote, id: "first", callsign: "FIRST", sequence: 1, scheduledDepartureUtc: "0001-01-01T00:00:00Z", scheduledArrivalUtc: "0001-01-01T00:00:00Z" },
      { ...remote, id: "third", callsign: "THIRD", sequence: 3 },
      { ...remote, id: "second", callsign: "SECOND", sequence: 2 },
    ] }) }));
    await render(); await load();
    const text = document.querySelector('[aria-label="Infinite Flight schedules"]')!.textContent!;
    expect(text.indexOf("THIRD")).toBeLessThan(text.indexOf("SECOND"));
    expect(text.indexOf("SECOND")).toBeLessThan(text.indexOf("FIRST"));
    expect(text).toContain("Planned times not specified");
    expect(text).not.toContain("Jan 1,");
  });
  it("reverses the provider's order when queue sequences are absent", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ success: true, data: snapshot({ schedules: [
      { ...remote, id: "old", callsign: "OLD", sequence: null }, { ...remote, id: "new", callsign: "NEW", sequence: null },
    ] }) }));
    await render(); await load();
    const text = document.querySelector('[aria-label="Infinite Flight schedules"]')!.textContent!;
    expect(text.indexOf("NEW")).toBeLessThan(text.indexOf("OLD"));
  });
  it("offers admin external edits only for editable flights and explicitly locks arrived flights", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ success: true, data: snapshot({ schedules: [remote,
      { ...remote, id: "done", callsign: "ARRIVED", status: 11, editable: false },
    ] }) }));
    await render(true); await load();
    expect(document.body.textContent).toContain("Arrived flights are locked.");
    expect(Array.from(document.querySelectorAll("button")).filter(item => item.textContent?.trim() === "Edit IF schedule")).toHaveLength(1);
    await act(async () => button("Edit IF schedule").click());
    expect(document.body.textContent).toContain("Edit Infinite Flight schedule");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("publishes only the selected aircraft's queued jobs without an implicit schedule reload", async () => {
    mocks.fetch.mockImplementation(async (path: string) => Response.json({ success: true, data: path.endsWith("/publish") ? { processed: 2, published: 1, disabled: false, states: { published: 1, conflict: 1 } } : snapshot() }));
    await render(true); await load();
    expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/scheduling/if/schedules?aircraftId=12", expect.any(Object));
    await act(async () => button("Publish queued flights").click());
    expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/scheduling/if/publish", expect.objectContaining({ method: "POST", body: JSON.stringify({ aircraftId: 12 }) }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(document.body.textContent).toContain("1 of 2 processed jobs synchronized with IF");
    expect(document.body.textContent).toContain("1 conflict");
    expect(mocks.fetch.mock.calls.filter(([path]) => path.includes("/schedules?")).length).toBe(1);
  });
  it("blocks publishing when its configuration is unavailable while allowing requested reads", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ success: true, data: snapshot({ publishingReady: false, publishingDisabledReasons: ["Automatic IF publishing is disabled"] }) }));
    await render(true); await load();
    expect(button("Publish queued flights").disabled).toBe(true);
    expect(document.body.textContent).toContain("Automatic IF publishing is disabled");
    expect(document.body.textContent).toContain("EXTERNAL8");
  });
  it("ignores a previous aircraft's response after the selected aircraft changes without loading the new aircraft", async () => {
    let release!: (value: Response) => void;
    mocks.fetch.mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve; }));
    await render(); await load();
    await render(false, { ...aircraft, id: 13, registration: "C-NEXT", if_aircraft_id: "other-aircraft" });
    await act(async () => release(Response.json({ success: true, data: snapshot({ schedules: [{ ...remote, callsign: "STALE" }] }) })));
    expect(document.body.textContent).not.toContain("STALE");
    expect(document.body.textContent).toContain("C-NEXT");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(button("Load IF schedules")).toBeDefined();
  });
  it("does not update a new aircraft's schedules when an earlier publication finishes", async () => {
    let release!: (value: Response) => void;
    mocks.fetch.mockImplementation(async (path: string) => path.endsWith("/publish")
      ? new Promise<Response>(resolve => { release = resolve; })
      : Response.json({ success: true, data: snapshot({ schedules: [{ ...remote, callsign: path.endsWith("=13") ? "NEW13" : "OLD12" }] }) }));
    await render(true); await load();
    await act(async () => button("Publish queued flights").click());
    await render(true, { ...aircraft, id: 13, registration: "C-NEXT" }); await load();
    await act(async () => release(Response.json({ success: true, data: { processed: 1, published: 1, disabled: false } })));
    expect(document.body.textContent).toContain("NEW13");
    expect(document.body.textContent).not.toContain("OLD12");
    expect(refresh).not.toHaveBeenCalled();
    expect(mocks.fetch.mock.calls.filter(([path]) => path.endsWith("=12")).length).toBe(1);
  });
});
