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
function snapshot(overrides: Record<string, unknown> = {}) { return { aircraft: [{ id: 12, position, nearbyAirport: { icao: "KJFK", distanceNm: 0.2 } }], loadedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(), ...overrides }; }
let root: Root; let container: HTMLDivElement;
const add = vi.fn(), edit = vi.fn(), request = vi.fn(), schedules = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.fetch.mockImplementation(async () => Response.json({ success: true, data: snapshot() }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.resetAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function render(admin = true, tails = [aircraft]) { await act(async () => root.render(<LiveFleet aircraft={tails} admin={admin} onAdd={add} onEdit={edit} onRequest={request} onSchedules={schedules} />)); }
function button(label: string) { return Array.from(container.querySelectorAll("button")).find(item => item.textContent?.trim() === label)!; }
async function refresh() { await act(async () => button("Refresh IF locations").click()); }
describe("admin-requested fleet positions", () => {
  it("never loads positions until the admin clicks refresh, including focus/visibility events", async () => {
    await render(); await act(async () => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
    expect(mocks.fetch).not.toHaveBeenCalled(); expect(container.textContent).toContain("Use Refresh IF locations");
    await refresh(); expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/scheduling/if/positions?aircraftIds=12", expect.objectContaining({ cache: "no-store" }));
    expect(container.textContent).toContain("Confirmed airport CYYZ"); expect(container.textContent).toContain("Near KJFK · 0.2 NM (estimate)");
    expect(container.textContent).toContain("40.6413, -73.7781"); expect(container.textContent).toContain("Last reported 03 Oct 2026, 18:22 UTC");
    expect(container.querySelector<HTMLAnchorElement>('a[href*="openstreetmap.org"]')?.href).toContain("mlat=40.6413&mlon=-73.7781");
  });
  it("never renders or requests positions for pilots, even when aircraft are linked", async () => {
    await render(false); expect(button("Refresh IF locations")).toBeUndefined(); expect(container.textContent).not.toContain("Last IF position");
    expect(mocks.fetch).not.toHaveBeenCalled(); await act(async () => button("Request flight").click()); expect(request).toHaveBeenCalledWith(aircraft);
  });
  it("keeps manual aircraft and admin actions usable", async () => {
    await render(true, [{ ...aircraft, if_aircraft_id: null }]); expect(mocks.fetch).not.toHaveBeenCalled(); expect(button("Refresh IF locations")).toBeUndefined();
    await act(async () => { button("Edit").click(); button("Add aircraft").click(); button("View schedules").click(); });
    expect(edit).toHaveBeenCalled(); expect(add).toHaveBeenCalledOnce(); expect(schedules).toHaveBeenCalled();
  });
  it("keeps old positions visible with a warning after sixty seconds, without polling", async () => {
    vi.useFakeTimers(); await render(); await refresh();
    await act(async () => vi.advanceTimersByTime(60001)); expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("40.6413, -73.7781"); expect(container.textContent).toContain("Last refresh is older than 60 seconds");
    await act(async () => vi.advanceTimersByTime(15 * 60000)); expect(mocks.fetch).toHaveBeenCalledOnce();
    await refresh(); expect(mocks.fetch).toHaveBeenCalledTimes(2); expect(container.textContent).not.toContain("Last refresh is older than 60 seconds");
  });
  it("uses the successful refresh age rather than deleting a snapshot at server cache expiry", async () => {
    vi.useFakeTimers(); mocks.fetch.mockImplementation(async () => Response.json({ success: true, data: snapshot({ expiresAt: new Date(Date.now() + 10000).toISOString() }) }));
    await render(); await refresh(); await act(async () => vi.advanceTimersByTime(10001));
    expect(container.textContent).toContain("40.6413"); expect(container.textContent).not.toContain("Last refresh is older");
    await act(async () => vi.advanceTimersByTime(50000)); expect(container.textContent).toContain("Last refresh is older"); expect(mocks.fetch).toHaveBeenCalledOnce();
  });
  it("reads only visible linked local IDs, with no automatic fetch on pagination", async () => {
    const tails = Array.from({ length: 8 }, (_, index) => ({ ...aircraft, id: index + 1, registration: `C-TST${index + 1}` }));
    await render(true, tails); await refresh(); expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/scheduling/if/positions?aircraftIds=1%2C2%2C3%2C4%2C5%2C6", expect.any(Object));
    await act(async () => button("Next").click()); expect(mocks.fetch).toHaveBeenCalledOnce(); expect(container.textContent).toContain("Aircraft 7–8 of 8");
    await refresh(); expect(mocks.fetch).toHaveBeenLastCalledWith("/api/admin/scheduling/if/positions?aircraftIds=7%2C8", expect.any(Object));
  });
  it("excludes manual tails from a mixed batch", async () => {
    await render(true, [aircraft, { ...aircraft, id: 13, if_aircraft_id: null }]); await refresh();
    expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/scheduling/if/positions?aircraftIds=12", expect.any(Object));
    expect(container.querySelectorAll('[aria-label="IF aircraft location"]')).toHaveLength(1);
  });
  it("isolates missing positions and optional airport lookup failures", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ success: true, data: snapshot({ airportLookupError: "Directory unavailable", aircraft: [
      { id: 12, position: null, nearbyAirport: null, error: "IF has no persisted position for this aircraft." }, { id: 13, position, nearbyAirport: null },
    ] }) }));
    await render(true, [aircraft, { ...aircraft, id: 13 }]); await refresh(); expect(container.textContent).toContain("IF has no persisted position");
    expect(container.textContent).toContain("40.6413"); expect(container.textContent).toContain("Nearby-airport estimates are unavailable");
  });
  it("retains the last successful snapshot after a transient failed refresh", async () => {
    await render(); await refresh(); mocks.fetch.mockResolvedValue(Response.json({ success: false, error: "IF is unavailable" }, { status: 503 })); await refresh();
    expect(container.textContent).toContain("40.6413"); expect(container.querySelector('[role="alert"]')?.textContent).toContain("IF is unavailable");
  });
  it.each([401, 403])("clears protected snapshots on access denial %i", async status => {
    await render(); await refresh(); mocks.fetch.mockResolvedValue(Response.json({ success: false, error: "Scheduling access denied" }, { status })); await refresh();
    expect(container.textContent).not.toContain("40.6413"); expect(container.textContent).toContain("Scheduling access denied");
  });
  it("ignores delayed results from a prior binding and never automatically loads the new one", async () => {
    let release!: (value: Response) => void; mocks.fetch.mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve; }));
    await render(); await refresh(); await render(true, [{ ...aircraft, if_aircraft_id: "new-instance" }]);
    await act(async () => release(Response.json({ success: true, data: snapshot() })));
    expect(container.textContent).not.toContain("40.6413"); expect(mocks.fetch).toHaveBeenCalledOnce();
    await refresh(); expect(container.textContent).toContain("40.6413");
  });
  it("keeps a successful position displayed while another refresh is pending", async () => {
    await render(); await refresh(); let release!: (value: Response) => void; mocks.fetch.mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve; }));
    await refresh(); expect(container.textContent).toContain("Refreshing IF location"); expect(container.textContent).toContain("40.6413");
    await act(async () => release(Response.json({ success: true, data: snapshot() })));
  });
});
