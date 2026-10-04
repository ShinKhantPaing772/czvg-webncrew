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
