// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/utils/api", () => ({ authFetch: mocks.fetch }));
import { IfScheduleEditor, type RemoteSchedule } from "./if-schedule-editor";

const schedule: RemoteSchedule = {
  id: "external-schedule", callsign: "IFC123", originIcao: "CYYZ", destinationIcao: "KJFK",
  scheduledDepartureUtc: "2026-10-05T18:00:00Z", scheduledArrivalUtc: "2026-10-05T20:00:00Z",
  status: 1, crew: [{ userId: "captain", role: 0 }], sequence: 4, fingerprint: "a".repeat(64), managedFlightId: null, editable: true,
};
let root: Root;
let container: HTMLDivElement;
const saved = vi.fn(); const close = vi.fn(); const denied = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.fetch.mockResolvedValue(Response.json({ success: true, data: { schedule: { ...schedule, callsign: "UPDATED" } } }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.resetAllMocks(); vi.unstubAllGlobals();
});
async function render(value = schedule) {
  await act(async () => root.render(<IfScheduleEditor aircraftId={12} schedule={value} onClose={close} onSave={saved} onDenied={denied} />));
}
async function input(id: string, value: string) {
  await act(async () => {
    const node = document.getElementById(id) as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

describe("external IF schedule editor", () => {
  it("writes the local aircraft ID and optimistic fingerprint only after explicit submission", async () => {
    await render();
    expect(mocks.fetch).not.toHaveBeenCalled();
    await input("if-schedule-callsign", "UPDATED");
    await input("if-schedule-destination", "klax");
    await submit();
    expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/scheduling/if/schedules", expect.objectContaining({
      method: "PATCH", body: JSON.stringify({ aircraftId: 12, scheduleId: schedule.id, expectedFingerprint: schedule.fingerprint,
        changes: { callsign: "UPDATED", originIcao: "CYYZ", destinationIcao: "KLAX", scheduledDepartureUtc: "2026-10-05T18:00:00Z", scheduledArrivalUtc: "2026-10-05T20:00:00Z" } }),
    }));
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ callsign: "UPDATED", id: schedule.id }));
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...schedule, status: 11, editable: true },
    { ...schedule, managedFlightId: 42 },
    { ...schedule, editable: false },
    { ...schedule, fingerprint: undefined },
  ])("will not submit a locked or managed flight even if invoked directly", async value => {
    await render(value); await submit();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("cannot be edited directly");
  });
  it("keeps year-one defaults out of inputs and permits an untimed schedule", async () => {
    await render({ ...schedule, scheduledDepartureUtc: "0001-01-01T00:00:00Z", scheduledArrivalUtc: null });
    expect(document.getElementById("if-schedule-departure")).toBeNull();
    expect((document.getElementById("if-schedule-set-times") as HTMLInputElement).checked).toBe(false);
    await submit();
    const body = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(body.changes.scheduledDepartureUtc).toBeNull();
    expect(body.changes.scheduledArrivalUtc).toBeNull();
  });
  it("requires a valid time pair only when planned times are enabled", async () => {
    await render({ ...schedule, scheduledDepartureUtc: null, scheduledArrivalUtc: null });
    await act(async () => (document.getElementById("if-schedule-set-times") as HTMLInputElement).click());
    expect((document.getElementById("if-schedule-departure") as HTMLInputElement).value).toBe("");
    expect((document.getElementById("if-schedule-arrival") as HTMLInputElement).value).toBe("");
    await submit();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Enter valid UTC departure and arrival times");
  });
  it("clears an existing planned time pair when the administrator disables it", async () => {
    await render();
    await act(async () => (document.getElementById("if-schedule-set-times") as HTMLInputElement).click());
    await submit();
    const body = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(body.changes.scheduledDepartureUtc).toBeNull();
    expect(body.changes.scheduledArrivalUtc).toBeNull();
  });
  it("does not send a backwards time range", async () => {
    await render(); await input("if-schedule-arrival", "2026-10-05T17:00"); await submit();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("preserves the form and explains a stale fingerprint denial", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ success: false, error: "IF flight changed; refresh before editing" }, { status: 409 }));
    await render(); await submit();
    expect(saved).not.toHaveBeenCalled();
    expect(denied).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("IF flight changed; refresh before editing");
    expect((document.getElementById("if-schedule-callsign") as HTMLInputElement).value).toBe("IFC123");
  });
  it.each([401, 403])("clears protected schedule content through the parent on access denial (%s)", async status => {
    mocks.fetch.mockResolvedValue(Response.json({ success: false, error: "Scheduling permission required" }, { status }));
    await render(); await submit();
    expect(denied).toHaveBeenCalledOnce();
    expect(saved).not.toHaveBeenCalled();
  });
  it("requires a refresh when an update result is uncertain and never automatically retries", async () => {
    mocks.fetch.mockRejectedValue(new Error("Connection closed"));
    await render(); await submit();
    expect(saved).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Connection closed");
  });
});
