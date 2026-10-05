// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlightStatus, ScheduledFlight, SchedulingData } from "./types";

const mocks = vi.hoisted(() => ({ scheduling: vi.fn() }));
vi.mock("./use-scheduling", () => ({ useScheduling: mocks.scheduling, schedulingResponse: vi.fn() }));
vi.mock("@/components/crew-header", () => ({ CrewHeader: ({ children }: { children: ReactNode }) => children }));
import { SchedulingWorkspace } from "./workspace";

let root: Root;
let container: HTMLDivElement;
let data: SchedulingData;
function flight(id: number, status: FlightStatus): ScheduledFlight {
  return {
    id, public_id: `flight-${id}`, live_aircraft_id: 1, captain_id: 1, callsign: `FLIGHT-${status.toUpperCase()}`,
    departure: "CYYZ", arrival: "KJFK", scheduled_departure: null, scheduled_arrival: null,
    status, created_at: "2026-10-04T13:30:17.000Z", revision: 1, captain: { id: 1, name: "Captain", callsign: "WNC1" }, members: [],
  };
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  data = {
    aircraft: [{ id: 1, registration: "C-TEST", aircraft_id: 10, current_airport: "CYYZ", active: true, name: "Airbus A320" }],
    flights: [flight(1, "approved"), flight(2, "pending"), flight(3, "completed"), flight(4, "rejected"), flight(5, "cancelled")],
    pilotId: 1, canAdmin: false,
  };
  mocks.scheduling.mockImplementation(() => ({ data, loading: false, refreshing: false, error: "", refresh: vi.fn(), mutate: vi.fn() }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.resetAllMocks(); vi.unstubAllGlobals();
});
async function render(admin = false) { await act(async () => root.render(<SchedulingWorkspace admin={admin} />)); }
async function filter(value: string) {
  const select = document.querySelector('[aria-label="Filter flight status"]') as HTMLSelectElement;
  await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
}
function button(label: string) {
  return Array.from(document.querySelectorAll("button")).find(item => item.textContent?.trim() === label)!;
}
async function selectFlight(status: FlightStatus) {
  const card = Array.from(document.querySelectorAll("button")).find(item => item.textContent?.includes(`FLIGHT-${status.toUpperCase()}`))!;
  expect(card).toBeDefined(); await act(async () => card.click());
}

describe("pilot scheduling visibility", () => {
  it("shows the original request time with UTC seconds on cards and details separately from the planned departure", async () => {
    data = { ...data, flights: [{ ...flight(1, "approved"), scheduled_departure: "2026-10-05T18:00:00Z" }] };
    await render();
    expect(document.body.textContent).toContain("Requested 04 Oct 2026, 13:30:17 UTC");
    await selectFlight("approved");
    const detail = document.querySelector('[role="dialog"]')!;
    expect(detail.textContent).toContain("Requested04 Oct 2026, 13:30:17 UTC");
    expect(detail.textContent).toContain("Scheduled departure05 Oct 2026, 18:00 UTC");
  });
  it("orders admin review by request time across aircraft, uses ID ties, and retains aircraft/queue order elsewhere", async () => {
    data = { ...data, flights: [
      { ...flight(20, "pending"), callsign: "NEWER", live_aircraft_id: 1, queue_order: 1, created_at: "2026-10-04T12:00:01Z", scheduled_departure: "2026-10-04T14:00:00Z" },
      { ...flight(30, "needs_review"), callsign: "OLDER-TIE", live_aircraft_id: 2, queue_order: 1, created_at: "2026-10-04T12:00:00Z", scheduled_departure: "2026-10-05T14:00:00Z" },
      { ...flight(10, "pending"), callsign: "OLDER-FIRST", live_aircraft_id: 2, queue_order: 2, created_at: "2026-10-04T12:00:00Z", scheduled_departure: null },
    ] };
    await render(true);
    let text = document.body.textContent!;
    expect(text.indexOf("OLDER-FIRST")).toBeLessThan(text.indexOf("OLDER-TIE"));
    expect(text.indexOf("OLDER-TIE")).toBeLessThan(text.indexOf("NEWER"));
    expect(text).toContain("Oldest flight requests first. Check conflicts before approving.");
    await filter("pending");
    text = document.body.textContent!;
    expect(text.indexOf("OLDER-FIRST")).toBeLessThan(text.indexOf("NEWER"));
    expect(text).not.toContain("OLDER-TIE");
    expect(text).toContain("Oldest flight requests first. Check conflicts before approving.");
    await filter("all");
    text = document.body.textContent!;
    expect(text.indexOf("NEWER")).toBeLessThan(text.indexOf("OLDER-TIE"));
    expect(text.indexOf("OLDER-TIE")).toBeLessThan(text.indexOf("OLDER-FIRST"));
    expect(text).not.toContain("Oldest flight requests first");
    await act(async () => { root.unmount(); root = createRoot(container); });
    await render();
    text = document.body.textContent!;
    expect(text.indexOf("NEWER")).toBeLessThan(text.indexOf("OLDER-TIE"));
    expect(text.indexOf("OLDER-TIE")).toBeLessThan(text.indexOf("OLDER-FIRST"));
  });
  it("omits rejected/cancelled flights and status options from all, history, and my flights with stale payloads", async () => {
    await render(); await filter("all");
    expect(document.body.textContent).toContain("FLIGHT-APPROVED");
    expect(document.body.textContent).toContain("FLIGHT-PENDING");
    expect(document.body.textContent).toContain("FLIGHT-COMPLETED");
    expect(document.body.textContent).not.toContain("FLIGHT-REJECTED");
    expect(document.body.textContent).not.toContain("FLIGHT-CANCELLED");
    const options = Array.from(document.querySelectorAll('[aria-label="Filter flight status"] option')).map(option => option.textContent);
    expect(options).not.toContain("Rejected"); expect(options).not.toContain("Cancelled");
    await filter("history");
    expect(document.body.textContent).toContain("FLIGHT-COMPLETED");
    expect(document.body.textContent).not.toContain("FLIGHT-APPROVED");
    const mine = document.querySelector('[role="tab"][data-state="inactive"]') as HTMLButtonElement;
    expect(mine.textContent).toBe("My flights");
    await act(async () => { mine.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); mine.click(); });
    expect(document.body.textContent).toContain("FLIGHT-COMPLETED");
    expect(document.body.textContent).not.toContain("FLIGHT-REJECTED");
    expect(document.body.textContent).not.toContain("FLIGHT-CANCELLED");
  });
  it("preserves rejected/cancelled flights and status options for admin review", async () => {
    await render(true); await filter("history");
    expect(document.body.textContent).toContain("FLIGHT-COMPLETED");
    expect(document.body.textContent).toContain("FLIGHT-REJECTED");
    expect(document.body.textContent).toContain("FLIGHT-CANCELLED");
    const options = Array.from(document.querySelectorAll('[aria-label="Filter flight status"] option')).map(option => option.textContent);
    expect(options).toContain("Rejected"); expect(options).toContain("Cancelled");
  });
  it.each(["rejected", "cancelled"] as const)("closes a pilot's selected flight when a refresh changes it to %s", async status => {
    await render(); await selectFlight("approved");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    data = { ...data, flights: data.flights.map(row => row.id === 1 ? { ...row, status } : row) };
    await render();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.textContent).not.toContain("FLIGHT-APPROVED");
  });
  it("closes a pending pilot amendment when a refresh cancels the flight", async () => {
    await render(); await selectFlight("pending");
    await act(async () => button("Edit flight").click());
    expect(document.body.textContent).toContain("Edit flight request");
    data = { ...data, flights: data.flights.map(row => row.id === 2 ? { ...row, status: "cancelled" } : row) };
    await render();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
