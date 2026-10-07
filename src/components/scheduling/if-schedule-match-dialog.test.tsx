// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveAircraft, ScheduledFlight } from "./types";
import type { RemoteSchedule } from "./if-schedule-editor";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/utils/api", () => ({ authFetch: mocks.fetch }));
import { IfScheduleMatchDialog } from "./if-schedule-match-dialog";

const aircraft: LiveAircraft = { id: 12, registration: "C-TEST", aircraft_id: 1, current_airport: "CYYZ", active: true, if_aircraft_id: "aircraft", name: "Airbus A320" };
const flight: ScheduledFlight = { id: 4, public_id: "local", live_aircraft_id: 12, captain_id: 1, callsign: "LOCAL4", departure: "CYYZ", arrival: "KJFK", scheduled_departure: null, scheduled_arrival: null, status: "approved", revision: 2, flight_type: "commercial", notes: "Local approved briefing", captain: { id: 1, name: "Captain", callsign: "WNC1" }, members: [{ id: 20, flight_id: 4, pilot_id: 2, status: "approved", pilot: { id: 2, name: "Crew", callsign: "WNC2" } }] };
const schedule: RemoteSchedule = { id: "external", callsign: "REMOTE4", originIcao: "CYYZ", destinationIcao: "KJFK", scheduledDepartureUtc: "2026-10-05T18:00:00Z", scheduledArrivalUtc: "2026-10-05T20:00:00Z", status: 1, flightType: 1, crew: [{ userId: "captain-if", role: 0 }], fingerprint: "a".repeat(64), editable: true, matchable: true };
const pilots = [{ id: 1, name: "Captain", callsign: "WNC1", ifuserid: "captain-if" }, { id: 2, name: "Crew", callsign: "WNC2", ifuserid: "crew-if" }];
let root: Root;
let container: HTMLDivElement;
const matched = vi.fn(async () => {});
const denied = vi.fn();
const stale = vi.fn();
const close = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  mocks.fetch.mockImplementation(async () => Response.json({ success: true, data: { flightId: flight.id } }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.resetAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function render(options: { flights?: ScheduledFlight[]; remote?: RemoteSchedule; loadedAt?: string; isStale?: boolean } = {}) {
  await act(async () => root.render(<IfScheduleMatchDialog aircraft={aircraft} schedule={options.remote || schedule} flights={options.flights || [flight]} pilots={pilots} loadedAt={options.loadedAt || new Date().toISOString()} stale={Boolean(options.isStale)} onClose={close} onDenied={denied} onStale={stale} onMatched={matched} />));
}
function button(label: string) { return Array.from(document.querySelectorAll("button")).find(item => item.textContent?.trim() === label)!; }
async function choose() {
  const select = document.getElementById("if-match-flight") as HTMLSelectElement;
  await act(async () => { select.value = "4"; select.dispatchEvent(new Event("change", { bubbles: true })); });
}
async function confirm() {
  await act(async () => (document.getElementById("if-match-confirm") as HTMLButtonElement).click());
  await act(async () => document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

describe("admin flight matching", () => {
  it("requires an explicit selection and same-flight confirmation, sends concurrency tokens, and shows approved crew IF IDs", async () => {
    await render();
    expect(button("Confirm flight match").disabled).toBe(true);
    expect(mocks.fetch).not.toHaveBeenCalled();
    await choose();
    expect(button("Confirm flight match").disabled).toBe(true);
    const local = document.querySelector('[aria-label="Crew Center flight comparison"]')!.textContent!;
    expect(local).toContain("LOCAL4"); expect(local).toContain("captain-if"); expect(local).toContain("crew-if"); expect(local).toContain("Planned times not specified"); expect(local).toContain("Local approved briefing");
    expect(document.querySelector('[aria-label="Infinite Flight comparison"]')!.textContent).toContain("REMOTE4");
    expect(document.body.textContent).toContain("It creates no duplicate flight");
    expect(document.body.textContent).toContain("run when IF publishing is enabled");
    await confirm();
    expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/scheduling/if/match", expect.objectContaining({ method: "POST", body: JSON.stringify({ flightId: 4, scheduleId: "external", expectedFingerprint: schedule.fingerprint, expectedRevision: 2 }) }));
    expect(matched).toHaveBeenCalledWith(4);
  });
  it("excludes other aircraft, pending flights, and flights linked elsewhere while allowing a same-ID recovery", async () => {
    await render({ flights: [{ ...flight, if_schedule_id: "external", publishing_state: "reconciliation" }, { ...flight, id: 5, live_aircraft_id: 13 }, { ...flight, id: 6, status: "pending" }, { ...flight, id: 7, if_schedule_id: "another" }] });
    expect(Array.from(document.querySelectorAll("#if-match-flight option")).map(option => (option as HTMLOptionElement).value)).toEqual(["", "4"]);
    await choose(); await confirm(); expect(matched).toHaveBeenCalledWith(4);
  });
  it("requires a new manual snapshot after sixty seconds even if the dialog has not rerendered", async () => {
    vi.useFakeTimers();
    await render(); await choose();
    await act(async () => (document.getElementById("if-match-confirm") as HTMLButtonElement).click());
    await act(async () => vi.advanceTimersByTime(60001));
    await act(async () => document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(mocks.fetch).not.toHaveBeenCalled(); expect(stale).toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Refresh IF schedules");
  });
  it.each([401, 403])("clears protected parent data when matching access is denied (%s)", async status => {
    mocks.fetch.mockImplementation(async () => Response.json({ success: false, error: "Scheduling access required" }, { status }));
    await render(); await choose(); await confirm();
    expect(denied).toHaveBeenCalledOnce(); expect(matched).not.toHaveBeenCalled();
  });
  it("retains the comparison after a changed IF snapshot and requires a refresh", async () => {
    mocks.fetch.mockImplementation(async () => Response.json({ success: false, code: "stale", error: "IF schedule changed. Refresh and compare again." }, { status: 409 }));
    await render(); await choose(); await confirm();
    expect(stale).toHaveBeenCalledOnce(); expect(matched).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("IF schedule changed");
    expect(document.body.textContent).toContain("LOCAL4");
  });
});
