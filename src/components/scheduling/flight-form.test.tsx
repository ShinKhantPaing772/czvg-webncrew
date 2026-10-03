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
});

async function submit() {
  const form = document.body.querySelector("form")!;
  expect(form).not.toBeNull();
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
}

describe("live flight request form", () => {
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
