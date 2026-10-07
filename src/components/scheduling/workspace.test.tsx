// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlightStatus, ScheduledFlight, SchedulingData } from "./types";

const mocks = vi.hoisted(() => ({ scheduling: vi.fn(), response: vi.fn(), refresh: vi.fn(), mutate: vi.fn(), fetch: vi.fn() }));
vi.mock("./use-scheduling", () => ({ useScheduling: mocks.scheduling, schedulingResponse: mocks.response }));
vi.mock("@/lib/utils/api", () => ({ authFetch: mocks.fetch }));
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
  mocks.refresh.mockResolvedValue(undefined);
  mocks.mutate.mockResolvedValue(undefined);
  mocks.response.mockImplementation((response: Response) => response.json());
  mocks.scheduling.mockImplementation(() => ({ data, loading: false, refreshing: false, error: "", refresh: mocks.refresh, mutate: mocks.mutate }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});

describe("individual admin IF publishing", () => {
  it("adds the individual publishing button after approving a linked flight and disables other actions while publishing", async () => {
    data = { ...data, aircraft: data.aircraft.map(tail => ({ ...tail, if_aircraft_id: "if-aircraft" })), flights: [flight(2, "pending")] };
    mocks.mutate.mockImplementation(async (input: Record<string, unknown>) => {
      if (input.action === "approve") data = { ...data, flights: [{ ...data.flights[0], status: "approved", publishing_state: "queued" }] };
    });
    await render(true); await selectFlight("pending");
    expect(button("Publish to IF")).toBeUndefined();
    await act(async () => button("Approve flight").click());
    await act(async () => button("Confirm").click());
    expect(button("Publish to IF")).toBeDefined();
    let resolvePublish!: (response: Response) => void;
    mocks.fetch.mockImplementation(() => new Promise<Response>(resolve => { resolvePublish = resolve; }));
    await act(async () => button("Publish to IF").click());
    expect(button("Edit flight").disabled).toBe(true);
    expect(button("Cancel flight").disabled).toBe(true);
    expect(button("Change captain").disabled).toBe(true);
    expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/scheduling/if/publish", expect.objectContaining({ method: "POST", body: '{"flightId":2}' }));
    await act(async () => resolvePublish(new Response(JSON.stringify({ success: true, data: { processed: 1, published: 1, disabled: false, flight: { id: 2, state: "published", message: "This flight’s latest approved schedule and crew are published to IF.", revision: 1, publishedRevision: 1 } } }))));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("This flight’s latest approved schedule and crew are published to IF.");
    expect(button("Edit flight").disabled).toBe(false);
  });
  it("does not expose the admin publication action to pilots", async () => {
    data = { ...data, aircraft: data.aircraft.map(tail => ({ ...tail, if_aircraft_id: "if-aircraft" })), flights: [flight(1, "approved")] };
    await render(); await selectFlight("approved");
    expect(button("Publish to IF")).toBeUndefined();
  });
  it.each(["pending", "in_progress", "completed", "needs_review", "cancelled", "rejected"] as FlightStatus[])("does not publish a %s flight from its details", async status => {
    data = { ...data, aircraft: data.aircraft.map(tail => ({ ...tail, if_aircraft_id: "if-aircraft" })), flights: [flight(1, status)] };
    await render(true); await filter("all"); await selectFlight(status);
    expect(button("Publish to IF")).toBeUndefined();
  });
  it("does not offer IF publishing for an unlinked aircraft", async () => {
    data = { ...data, flights: [flight(1, "approved")] };
    await render(true); await filter("all"); await selectFlight("approved");
    expect(button("Publish to IF")).toBeUndefined();
  });
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

describe("pilot unscheduled aircraft", () => {
  function emptyAircraft(id: number, registration: string) {
    return { ...data.aircraft[0], id, registration, current_airport: "EGLL", pending_request_count: 0, approved_schedule_count: 0, in_progress_count: 0 };
  }
  it("shows active aircraft with no pending or reserved flights in the default Flights view and preselects them for a request", async () => {
    data = { ...data, aircraft: [...data.aircraft, emptyAircraft(2, "B-AVAILABLE")], flights: [...data.flights, ...(["completed", "cancelled", "rejected"] as const).map((status, index) => ({ ...flight(10 + index, status), live_aircraft_id: 2 }))] };
    await render();
    const section = document.querySelector('section[aria-label="Unscheduled aircraft"]')!;
    expect(section).not.toBeNull();
    expect(section.textContent).toContain("B-AVAILABLE");
    expect(section.textContent).toContain("Confirmed airport EGLL");
    expect(section.textContent).toContain("No scheduled flights");
    expect(section.textContent).not.toContain("C-TEST");
    expect(mocks.fetch).not.toHaveBeenCalled();
    await act(async () => Array.from(section.querySelectorAll("button")).find(item => item.textContent === "Request flight")!.click());
    expect((document.querySelector("#flight-aircraft") as HTMLSelectElement).value).toBe("2");
    expect((document.querySelector("#flight-departure") as HTMLInputElement).value).toBe("EGLL");
  });
  it("uses complete per-aircraft counts rather than visible flights, and excludes inactive or unknown availability", async () => {
    data = { ...data, flights: [], aircraft: [
      emptyAircraft(2, "B-AVAILABLE"),
      { ...emptyAircraft(3, "B-PRIVATE-PENDING"), pending_request_count: 1 },
      { ...emptyAircraft(4, "B-APPROVED"), approved_schedule_count: 1 },
      { ...emptyAircraft(5, "B-IN-PROGRESS"), in_progress_count: 1 },
      { ...emptyAircraft(6, "B-INACTIVE"), active: false },
      { ...emptyAircraft(7, "B-UNKNOWN"), pending_request_count: undefined },
    ] };
    await render();
    const section = document.querySelector('section[aria-label="Unscheduled aircraft"]')!;
    expect(section.textContent).toContain("B-AVAILABLE");
    for (const registration of ["B-PRIVATE-PENDING", "B-APPROVED", "B-IN-PROGRESS", "B-INACTIVE", "B-UNKNOWN"]) expect(section.textContent).not.toContain(registration);
  });
  it("respects aircraft and airport search filters without mislabeling scheduled aircraft", async () => {
    data = { ...data, aircraft: [data.aircraft[0], emptyAircraft(2, "B-AVAILABLE"), { ...emptyAircraft(3, "B-OTHER"), current_airport: "KJFK" }] };
    await render();
    const search = document.querySelector('[aria-label="Search flights"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, "EGLL");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(document.querySelector('section[aria-label="Unscheduled aircraft"]')!.textContent).toContain("B-AVAILABLE");
    expect(document.querySelector('section[aria-label="Unscheduled aircraft"]')!.textContent).not.toContain("B-OTHER");
    const aircraftFilter = document.querySelector('[aria-label="Filter aircraft"]') as HTMLSelectElement;
    await act(async () => { aircraftFilter.value = "1"; aircraftFilter.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(document.querySelector('section[aria-label="Unscheduled aircraft"]')).toBeNull();
  });
  it("removes aircraft from the unscheduled section after a refreshed request and keeps history focused on flights", async () => {
    data = { ...data, aircraft: [...data.aircraft, emptyAircraft(2, "B-AVAILABLE")] };
    await render(); expect(document.querySelector('section[aria-label="Unscheduled aircraft"]')).not.toBeNull();
    await filter("history"); expect(document.querySelector('section[aria-label="Unscheduled aircraft"]')).toBeNull();
    await filter("upcoming");
    data = { ...data, aircraft: data.aircraft.map(tail => tail.id === 2 ? { ...tail, pending_request_count: 1 } : tail) };
    await render(); expect(document.querySelector('section[aria-label="Unscheduled aircraft"]')).toBeNull();
  });
});

describe("pilot scheduling visibility", () => {
  it.each([false, true])("honors the saved unpublished-start policy for pilots while showing the publishing issue (allowed: %s)", async allowed => {
    data = { ...data, aircraft: data.aircraft.map(tail => ({ ...tail, if_aircraft_id: "if-aircraft" })), configuration: { liveAwardConfigured: true, allowUnpublishedIfStarts: allowed }, flights: [{ ...flight(1, "approved"), publishing_state: "conflict" }] };
    await render(); await selectFlight("approved");
    expect(button("Start flight").disabled).toBe(!allowed);
    if (allowed) {
      expect(document.body.textContent).toContain("An admin has enabled local starts");
      await act(async () => button("Start flight").click());
      expect(document.body.textContent).toContain("The admin start policy skips IF publication and departure checks");
    } else expect(document.body.textContent).toContain("must be published to IF before departure");
  });
  it("continues blocking departures from a different local airport when the IF start policy is enabled", async () => {
    data = { ...data, aircraft: data.aircraft.map(tail => ({ ...tail, current_airport: "EGLL", if_aircraft_id: "if-aircraft" })), configuration: { liveAwardConfigured: true, allowUnpublishedIfStarts: true }, flights: [flight(1, "approved")] };
    await render(); await selectFlight("approved");
    expect(button("Start flight").disabled).toBe(true);
    expect(document.body.textContent).toContain("The aircraft must reach CYYZ");
  });
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
