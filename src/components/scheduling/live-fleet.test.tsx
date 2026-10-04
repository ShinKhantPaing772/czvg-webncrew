// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/utils/api", () => ({ authFetch: mocks.fetch }));
import { LiveFleet } from "./live-fleet";
import type { LiveAircraft } from "./types";

const aircraft: LiveAircraft = { id: 12, registration: "C-TEST", aircraft_id: 1, current_airport: "CYYZ", projected_airport: "KJFK", active: true, if_aircraft_id: "persistent-instance", name: "Airbus A320" };
const position = { state: 1, isOnGround: true, latitude: 40.6413, longitude: -73.7781, updatedAt: "2026-10-03T18:22:00Z" };
function snapshot(overrides: Record<string, unknown> = {}) {
  return { aircraft: [{ id: 12, position, nearbyAirport: { icao: "KJFK", distanceNm: 0.2 } }], loadedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(), ...overrides };
}
let root: Root;
let container: HTMLDivElement;
const add = vi.fn();
const edit = vi.fn();
const request = vi.fn();
const schedules = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.fetch.mockImplementation(async () => Response.json({ success: true, data: snapshot() }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.resetAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});
async function render(admin = false, aircraftList = [aircraft]) {
  await act(async () => root.render(<LiveFleet aircraft={aircraftList} admin={admin} onAdd={add} onEdit={edit} onRequest={request} onSchedules={schedules} />));
}
function button(label: string) {
  return Array.from(container.querySelectorAll("button")).find(item => item.textContent?.trim() === label)!;
}

describe("fleet IF positions", () => {
  it("loads a linked pilot aircraft automatically and keeps its confirmed airport separate from the estimate", async () => {
    await render();
    expect(mocks.fetch).toHaveBeenCalledWith("/api/scheduling/if/positions?aircraftIds=12", expect.objectContaining({ cache: "no-store" }));
    expect(container.textContent).toContain("Confirmed airport CYYZ");
    expect(container.textContent).toContain("After approved flights KJFK");
    expect(container.textContent).toContain("Last IF position");
    expect(container.textContent).toContain("On the ground");
    expect(container.textContent).toContain("Near KJFK · 0.2 NM (estimate)");
    expect(container.textContent).toContain("40.6413, -73.7781");
    expect(container.textContent).toContain("Last reported 03 Oct 2026, 18:22 UTC");
    expect(container.textContent).toContain("The nearby airport differs from CYYZ");
    const map = container.querySelector<HTMLAnchorElement>('a[href*="openstreetmap.org"]')!;
    expect(map.href).toContain("mlat=40.6413&mlon=-73.7781");
    expect(map.target).toBe("_blank");
    expect(mocks.fetch.mock.calls.every(([, options]) => !options.method || options.method === "GET")).toBe(true);
    expect(button("Edit")).toBeUndefined();
  });
  it("uses admin authorization and retains fleet actions", async () => {
    await render(true);
    expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/scheduling/if/positions?aircraftIds=12", expect.any(Object));
    await act(async () => { button("Edit").click(); button("Add aircraft").click(); button("View schedules").click(); });
    expect(edit).toHaveBeenCalledWith(aircraft); expect(add).toHaveBeenCalledOnce(); expect(schedules).toHaveBeenCalledWith(aircraft);
    expect(button("Request flight")).toBeUndefined();
  });
  it("keeps manual aircraft usable without an IF request", async () => {
    const tail = { ...aircraft, if_aircraft_id: null };
    await render(false, [tail]);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Manual scheduling");
    expect(container.textContent).not.toContain("Last IF position");
    await act(async () => button("Request flight").click());
    expect(request).toHaveBeenCalledWith(tail);
  });
  it("loads at most six visible local IDs and fetches the next page independently", async () => {
    const fleet = Array.from({ length: 8 }, (_, index) => ({ ...aircraft, id: index + 1, registration: `C-TST${index + 1}` }));
    await render(false, fleet);
    expect(mocks.fetch).toHaveBeenCalledWith("/api/scheduling/if/positions?aircraftIds=1%2C2%2C3%2C4%2C5%2C6", expect.any(Object));
    expect(container.textContent).toContain("Aircraft 1–6 of 8"); expect(container.textContent).not.toContain("C-TST7");
    await act(async () => button("Next").click());
    expect(mocks.fetch).toHaveBeenLastCalledWith("/api/scheduling/if/positions?aircraftIds=7%2C8", expect.any(Object));
    expect(container.textContent).toContain("C-TST7"); expect(container.textContent).not.toContain("C-TST1");
    expect(container.textContent).toContain("Aircraft 7–8 of 8");
  });
  it("does not include manual aircraft in a mixed fleet read", async () => {
    await render(false, [aircraft, { ...aircraft, id: 13, registration: "C-MANL", if_aircraft_id: null }]);
    expect(mocks.fetch).toHaveBeenCalledWith("/api/scheduling/if/positions?aircraftIds=12", expect.any(Object));
    expect(container.querySelectorAll('[aria-label="IF aircraft location"]')).toHaveLength(1);
  });
  it("isolates a missing position and still shows other positions and confirmed airports", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ success: true, data: snapshot({ aircraft: [
      { id: 12, position: null, nearbyAirport: null, error: "IF has no reported position for this aircraft.", code: "position_unavailable" },
      { id: 13, position, nearbyAirport: null },
    ] }) }));
    await render(false, [aircraft, { ...aircraft, id: 13, registration: "C-SECOND", current_airport: "EGLL" }]);
    expect(container.textContent).toContain("IF has no reported position");
    expect(container.textContent).toContain("40.6413, -73.7781");
    expect(container.textContent).toContain("Confirmed airport CYYZ"); expect(container.textContent).toContain("Confirmed airport EGLL");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
  it("still shows coordinates when the optional airport lookup fails", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ success: true, data: snapshot({ airportLookupError: "Airport lookup unavailable", aircraft: [{ id: 12, position: { ...position, state: 2, isOnGround: false }, nearbyAirport: null }] }) }));
    await render();
    expect(container.textContent).toContain("In flight");
    expect(container.textContent).toContain("40.6413, -73.7781");
    expect(container.textContent).toContain("Nearby-airport estimates are unavailable");
    expect(container.textContent).not.toContain("Near KJFK");
  });
  it("refreshes at the server's remaining cache lifetime, without adding another sixty seconds", async () => {
    vi.useFakeTimers();
    mocks.fetch.mockImplementation(async () => Response.json({ success: true, data: snapshot({ expiresAt: new Date(Date.now() + 10000).toISOString() }) }));
    await render();
    await act(async () => vi.advanceTimersByTime(9999)); expect(mocks.fetch).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(1)); expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("40.6413, -73.7781");
  });
  it("clears expired positions while hidden and reloads when the page becomes visible", async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("visible"); await render();
    visibility.mockReturnValue("hidden");
    await act(async () => vi.advanceTimersByTime(60000));
    expect(mocks.fetch).toHaveBeenCalledTimes(1); expect(container.textContent).not.toContain("40.6413");
    expect(container.textContent).toContain("IF location expired"); expect(container.textContent).toContain("CYYZ");
    visibility.mockReturnValue("visible");
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(mocks.fetch).toHaveBeenCalledTimes(2); expect(container.textContent).toContain("40.6413");
    visibility.mockRestore();
  });
  it("pauses automatic IF reads after fifteen minutes idle but permits a manual refresh", async () => {
    vi.useFakeTimers();
    await render();
    for (let minute = 1; minute < 15; minute += 1) await act(async () => vi.advanceTimersByTime(60000));
    expect(mocks.fetch).toHaveBeenCalledTimes(15);
    await act(async () => vi.advanceTimersByTime(60000));
    expect(mocks.fetch).toHaveBeenCalledTimes(15);
    expect(container.textContent).not.toContain("40.6413");
    expect(container.textContent).toContain("IF location expired");
    await act(async () => button("Refresh IF locations").click());
    expect(mocks.fetch).toHaveBeenCalledTimes(16); expect(container.textContent).toContain("40.6413");
    await act(async () => vi.advanceTimersByTime(60000)); expect(mocks.fetch).toHaveBeenCalledTimes(17);
  });
  it("clears protected positions after a denied refresh", async () => {
    await render();
    mocks.fetch.mockResolvedValue(Response.json({ success: false, error: "Live Pilot award required" }, { status: 403 }));
    await act(async () => button("Refresh IF locations").click());
    expect(container.textContent).not.toContain("40.6413");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Live Pilot award required");
    expect(container.textContent).toContain("Confirmed airport CYYZ");
  });
  it("ignores delayed results from an old aircraft binding", async () => {
    let release!: (value: Response) => void;
    mocks.fetch.mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve; }));
    await render();
    mocks.fetch.mockResolvedValue(Response.json({ success: true, data: snapshot({ aircraft: [{ id: 12, position: { ...position, latitude: 43.6777, longitude: -79.6248 }, nearbyAirport: { icao: "CYYZ", distanceNm: 0.1 } }] }) }));
    await render(false, [{ ...aircraft, if_aircraft_id: "new-instance" }]);
    await act(async () => release(Response.json({ success: true, data: snapshot() })));
    expect(container.textContent).toContain("43.6777, -79.6248"); expect(container.textContent).not.toContain("40.6413");
    expect(container.textContent).not.toContain("Near KJFK");
  });
  it("reports a slow read without letting an old response replace its retry", async () => {
    vi.useFakeTimers();
    mocks.fetch.mockImplementationOnce((_: string, options: RequestInit) => new Promise((_, reject) => options.signal!.addEventListener("abort", () => reject(new Error("aborted")))));
    await render();
    await act(async () => vi.advanceTimersByTime(25000));
    expect(container.textContent).toContain("IF locations took too long"); expect(button("Refresh IF locations").disabled).toBe(false);
    await act(async () => button("Refresh IF locations").click());
    expect(container.textContent).toContain("40.6413, -73.7781");
  });
});
