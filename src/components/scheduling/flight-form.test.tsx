// @vitest-environment jsdom

import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlightForm } from "./flight-form";
import { ScheduledFlight, SchedulingData } from "./types";

let root: Root;
let container: HTMLDivElement;
const flight: ScheduledFlight = {
  id: 1, public_id: "test-flight", live_aircraft_id: 1, captain_id: 1, callsign: "",
  departure: "CYYZ", arrival: "KJFK", scheduled_departure: "2026-10-02T10:00:00Z",
  scheduled_arrival: "2026-10-02T11:30:00Z", status: "pending", revision: 1,
  captain: { id: 1, name: "Captain", callsign: "WNC1" }, members: [],
};
const data: SchedulingData = {
  aircraft: [{ id: 1, registration: "C-WNCB", aircraft_id: 10, current_airport: "CYYZ", active: true, name: "Boeing 737" }],
  flights: [flight], pilotId: 1, canAdmin: false,
};

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function submit() {
  const form = document.body.querySelector("form")!;
  expect(form).not.toBeNull();
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
}

async function change(selector: string, value: string) {
  const field = document.querySelector(selector) as HTMLInputElement | HTMLSelectElement;
  await act(async () => {
    if (field instanceof HTMLSelectElement) {
      field.value = value; field.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}
async function toggleTimes() {
  await act(async () => (document.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
}

describe("live flight request form", () => {
  it("uses full aircraft counts without exposing hidden pending request details", async () => {
    await act(async () => root.render(<FlightForm data={{ ...data, flights: [], aircraft: [{ ...data.aircraft[0], pending_request_count: 4, approved_schedule_count: 2, in_progress_count: 1 }] }} onClose={vi.fn()} onSave={vi.fn()} />));
    const note = document.querySelector('[role="status"]')!;
    expect(note.textContent).toContain("4 other flight requests are awaiting admin approval");
    expect(note.textContent).toContain("Pending requests do not reserve it");
    expect(note.textContent).toContain("3 approved flights ahead of this request are not completed (1 currently in progress)");
  });

  it("updates queue notes when selecting an aircraft with no pending or unfinished approved flights", async () => {
    const fleet = [...data.aircraft.map(item => ({ ...item, pending_request_count: 1, approved_schedule_count: 1, in_progress_count: 0 })),
      { ...data.aircraft[0], id: 2, registration: "C-WNCC", current_airport: "CYVR", pending_request_count: 0, approved_schedule_count: 0, in_progress_count: 0 }];
    await act(async () => root.render(<FlightForm data={{ ...data, aircraft: fleet }} onClose={vi.fn()} onSave={vi.fn()} />));
    expect(document.querySelector('[role="status"]')?.textContent).toContain("1 other flight request is awaiting");
    expect(document.querySelector('[role="status"]')?.textContent).toContain("1 approved flight ahead of this request is not completed");
    await change("#flight-aircraft", "2");
    expect(document.querySelector('[role="status"]')?.textContent).toContain("No other flight requests");
    expect(document.querySelector('[role="status"]')?.textContent).toContain("No unfinished approved flights");
  });

  it("excludes the pending request being edited from other requests and responds to refreshed counts", async () => {
    const withCount = { ...data, aircraft: [{ ...data.aircraft[0], pending_request_count: 2, approved_schedule_count: 0, in_progress_count: 0 }] };
    await act(async () => root.render(<FlightForm data={withCount} flight={flight} onClose={vi.fn()} onSave={vi.fn()} />));
    expect(document.querySelector('[role="status"]')?.textContent).toContain("1 other flight request is awaiting");
    await act(async () => root.render(<FlightForm data={{ ...withCount, aircraft: [{ ...withCount.aircraft[0], pending_request_count: 1, approved_schedule_count: 1 }] }} flight={flight} onClose={vi.fn()} onSave={vi.fn()} />));
    expect(document.querySelector('[role="status"]')?.textContent).toContain("No other flight requests");
    expect(document.querySelector('[role="status"]')?.textContent).toContain("1 approved flight ahead");
  });

  it("counts only pending and reserved flights for the selected aircraft in legacy payloads", async () => {
    const flights: ScheduledFlight[] = [flight, { ...flight, id: 2, status: "approved" }, { ...flight, id: 3, status: "in_progress" },
      { ...flight, id: 4, status: "completed" }, { ...flight, id: 5, status: "cancelled" }, { ...flight, id: 6, status: "rejected" },
      { ...flight, id: 7, status: "needs_review" }, { ...flight, id: 8, live_aircraft_id: 2, status: "approved" }];
    await act(async () => root.render(<FlightForm data={{ ...data, flights }} onClose={vi.fn()} onSave={vi.fn()} />));
    expect(document.querySelector('[role="status"]')?.textContent).toContain("1 other flight request");
    expect(document.querySelector('[role="status"]')?.textContent).toContain("2 approved flights ahead of this request are not completed (1 currently in progress)");
  });

  it("does not show request queue notes while an admin amends an already approved flight", async () => {
    await act(async () => root.render(<FlightForm data={data} flight={{ ...flight, status: "approved" }} admin onClose={vi.fn()} onSave={vi.fn()} />));
    expect(document.querySelector('[role="status"]')).toBeNull();
  });

  it("defaults new flights to Commercial and offers Freight, Ferry, and Other with an accessible label", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(<FlightForm data={data} onClose={vi.fn()} onSave={save} />));
    const type = document.querySelector("#flight-type") as HTMLSelectElement;
    expect(type.value).toBe("commercial");
    expect(document.querySelector('label[for="flight-type"]')?.textContent).toBe("Flight type");
    expect(Array.from(type.options).map(option => option.textContent)).toEqual(expect.arrayContaining(["Commercial", "Freight", "Ferry", "Other"]));
    await change("#flight-arrival", "KJFK");
    await submit();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ flight_type: "commercial" }));
  });

  it.each(["freight", "ferry", "other"])("submits the selected %s flight type", async type => {
    const save = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(<FlightForm data={data} onClose={vi.fn()} onSave={save} />));
    await change("#flight-type", type);
    await change("#flight-arrival", "KJFK");
    await submit();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ flight_type: type }));
  });

  it.each([false, true])("preserves an existing Ferry purpose when editing (admin: %s)", async admin => {
    const save = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(<FlightForm data={data} admin={admin} flight={{ ...flight, flight_type: "ferry" }} onClose={vi.fn()} onSave={save} />));
    expect((document.querySelector("#flight-type") as HTMLSelectElement).value).toBe("ferry");
    await submit();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ flight_type: "ferry" }));
  });

  it("suggests optional UTC times after the last approved arrival and derives that leg's destination", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T08:00:00Z"));
    const save = vi.fn().mockResolvedValue(undefined);
    const queue: ScheduledFlight[] = [
      { ...flight, id: 2, status: "approved", departure: "KJFK", arrival: "EGLL", scheduled_departure: "2026-10-02T12:00:00Z", scheduled_arrival: "2026-10-02T18:30:30Z" },
      { ...flight, status: "approved" },
      { ...flight, id: 3, status: "pending", departure: "EGLL", arrival: "LFPG", scheduled_departure: "2026-10-03T20:00:00Z", scheduled_arrival: "2026-10-03T21:00:00Z" },
    ];
    await act(async () => root.render(<FlightForm data={{ ...data, flights: queue }} onClose={vi.fn()} onSave={save} />));
    await toggleTimes();
    expect((document.querySelector("#flight-departure-time") as HTMLInputElement).value).toBe("2026-10-02T18:31");
    expect((document.querySelector("#flight-arrival-time") as HTMLInputElement).value).toBe("2026-10-02T19:31");
    expect((document.querySelector("#flight-departure") as HTMLInputElement).value).toBe("EGLL");
    await change("#flight-arrival", "LFPG");
    await submit();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ departure: "EGLL", arrival: "LFPG", scheduled_departure: "2026-10-02T18:31:00.000Z" }));
  });

  it("recalculates suggested times when a new request selects another aircraft", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T08:00:00Z"));
    const fleetData: SchedulingData = { ...data,
      aircraft: [...data.aircraft, { ...data.aircraft[0], id: 2, registration: "C-WNCC", current_airport: "CYVR" }],
      flights: [{ ...flight, status: "in_progress" }],
    };
    await act(async () => root.render(<FlightForm data={fleetData} onClose={vi.fn()} onSave={vi.fn()} />));
    await toggleTimes();
    expect((document.querySelector("#flight-departure-time") as HTMLInputElement).value).toBe("2026-10-02T11:30");
    await change("#flight-aircraft", "2");
    expect((document.querySelector("#flight-departure-time") as HTMLInputElement).value).toBe("2026-10-02T09:00");
    expect((document.querySelector("#flight-arrival-time") as HTMLInputElement).value).toBe("2026-10-02T10:00");
    expect((document.querySelector("#flight-departure") as HTMLInputElement).value).toBe("CYVR");
  });

  it("lets a new request restore suggested times without making manual times mandatory to enter", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T08:00:00Z"));
    await act(async () => root.render(<FlightForm data={{ ...data, flights: [] }} onClose={vi.fn()} onSave={vi.fn()} />));
    await toggleTimes();
    await change("#flight-departure-time", "2026-10-05T20:00");
    const suggested = [...document.querySelectorAll("button")].find(button => button.textContent === "Use suggested times")!;
    await act(async () => suggested.click());
    expect((document.querySelector("#flight-departure-time") as HTMLInputElement).value).toBe("2026-10-02T09:00");
    expect((document.querySelector("#flight-arrival-time") as HTMLInputElement).value).toBe("2026-10-02T10:00");
  });

  it("submits a new flight with unspecified times without assigning hidden clock values", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const untimed = { ...flight, status: "approved" as const, queue_order: 5, scheduled_departure: null, scheduled_arrival: null };
    await act(async () => root.render(<FlightForm data={{ ...data, flights: [untimed] }} onClose={vi.fn()} onSave={save} />));
    expect(document.querySelector("#flight-departure-time")).toBeNull();
    expect((document.querySelector("#flight-departure") as HTMLInputElement).value).toBe("KJFK");
    await change("#flight-arrival", "KBOS");
    await submit();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ departure: "KJFK", arrival: "KBOS", scheduled_departure: null, scheduled_arrival: null }));
  });

  it("keeps suggested times after earlier timed reservations when the final queued leg is untimed", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T08:00:00Z"));
    const reserved: ScheduledFlight[] = [{ ...flight, status: "approved", queue_order: 1 },
      { ...flight, id: 2, status: "approved", queue_order: 2, departure: "KJFK", arrival: "KBOS", scheduled_departure: null, scheduled_arrival: null }];
    await act(async () => root.render(<FlightForm data={{ ...data, flights: reserved }} onClose={vi.fn()} onSave={vi.fn()} />));
    await toggleTimes();
    expect((document.querySelector("#flight-departure-time") as HTMLInputElement).value).toBe("2026-10-02T11:30");
    expect((document.querySelector("#flight-departure") as HTMLInputElement).value).toBe("KBOS");
  });

  it("lets existing planned flights explicitly clear both times", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(<FlightForm data={data} flight={flight} onClose={vi.fn()} onSave={save} />));
    await toggleTimes();
    await submit();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ scheduled_departure: null, scheduled_arrival: null }));
  });

  it("requires both UTC times when the optional times checkbox is selected", async () => {
    const save = vi.fn();
    await act(async () => root.render(<FlightForm data={data} flight={flight} onClose={vi.fn()} onSave={save} />));
    await change("#flight-arrival-time", "");
    await submit();
    expect(save).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("both UTC times");
  });

  it("submits UTC dates and an optional callsign without changing the edited aircraft", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();
    await act(async () => root.render(<FlightForm data={data} flight={flight} onClose={close} onSave={save} />));
    expect((document.querySelector("#flight-aircraft") as HTMLSelectElement).disabled).toBe(true);
    expect((document.querySelector("#flight-departure-time") as HTMLInputElement).value).toBe("2026-10-02T10:00");
    await submit();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      live_aircraft_id: 1, callsign: "", departure: "CYYZ", arrival: "KJFK",
      scheduled_departure: "2026-10-02T10:00:00.000Z", scheduled_arrival: "2026-10-02T11:30:00.000Z",
    }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("locks the derived origin but permits manual entry when location is unknown", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(<FlightForm data={data} flight={flight} onClose={vi.fn()} onSave={save} />));
    expect((document.querySelector("#flight-departure") as HTMLInputElement).readOnly).toBe(true);
    await act(async () => root.render(<FlightForm key="unknown" data={{ ...data, aircraft: [{ ...data.aircraft[0], current_airport: null }] }} flight={flight} onClose={vi.fn()} onSave={save} />));
    expect((document.querySelector("#flight-departure") as HTMLInputElement).readOnly).toBe(false);
    await submit();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ departure: "CYYZ" }));
  });

  it("keeps a rejected submission open and displays the server conflict", async () => {
    const save = vi.fn().mockRejectedValue(new Error("The aircraft already has an overlapping flight"));
    const close = vi.fn();
    await act(async () => root.render(<FlightForm data={data} flight={flight} onClose={close} onSave={save} />));
    await submit();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("overlapping flight");
    expect(close).not.toHaveBeenCalled();
  });

  it("rejects a backwards scheduled interval before submitting", async () => {
    const save = vi.fn();
    await act(async () => root.render(<FlightForm data={data} flight={{ ...flight, scheduled_arrival: "2026-10-02T09:00:00Z" }} onClose={vi.fn()} onSave={save} />));
    await submit();
    expect(save).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("after departure");
  });
});
