// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/utils/api", () => ({ authFetch: mocks.fetch }));
import { PublishFlightButton } from "./publish-flight-button";

let root: Root;
let container: HTMLDivElement;
const refresh = vi.fn(async () => {});
const denied = vi.fn();
const busy = vi.fn();
function published(id = 27) { return { processed: 1, published: 1, disabled: false, states: { published: 1 }, flight: { id, state: "published", message: "The latest approved schedule and crew are published to IF.", revision: 3, publishedRevision: 3 } }; }
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.fetch.mockImplementation(async () => Response.json({ success: true, data: published() }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.resetAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function render(flightId = 27, disabled = false) { await act(async () => root.render(<PublishFlightButton flightId={flightId} disabled={disabled} onRefresh={refresh} onDenied={denied} onBusyChange={busy} />)); }
function button() { return container.querySelector("button")!; }
async function publish() { await act(async () => button().click()); }

describe("individual approved-flight publishing", () => {
  it("publishes only the selected flight on explicit request and refreshes its local status", async () => {
    await render(); expect(mocks.fetch).not.toHaveBeenCalled();
    await publish();
    expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/scheduling/if/publish", expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ flightId: 27 }) }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(busy.mock.calls).toEqual([[true], [false]]);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("latest approved schedule and crew are published");
  });
  it("prevents two simultaneous clicks and lets the parent block other flight actions while publishing", async () => {
    let release!: (response: Response) => void;
    mocks.fetch.mockImplementation(() => new Promise<Response>(resolve => { release = resolve; }));
    await render();
    await act(async () => { button().click(); button().click(); });
    expect(mocks.fetch).toHaveBeenCalledOnce(); expect(button().disabled).toBe(true); expect(busy).toHaveBeenCalledWith(true);
    await act(async () => release(Response.json({ success: true, data: published() })));
    expect(button().disabled).toBe(false); expect(busy).toHaveBeenLastCalledWith(false);
  });
  it.each([
    { state: "blocked", message: "An earlier approved aircraft schedule must be published first.", states: { blocked: 1 }, processed: 0 },
    { state: "conflict", message: "An external IF schedule conflicts with this flight. Review the match before retrying.", states: { conflict: 1 }, processed: 1 },
    { state: "failed", message: "Only part of the crew was synchronized. Publishing is not complete.", states: { partial: 1 }, processed: 1 },
    { state: "queued", message: "This flight is waiting for its retry deadline.", states: { queued: 1 }, processed: 0 },
  ])("reports $state without claiming the flight published", async outcome => {
    mocks.fetch.mockImplementation(async () => Response.json({ success: true, data: { processed: outcome.processed, published: 0, disabled: false, states: outcome.states, flight: { id: 27, state: outcome.state, message: outcome.message, revision: 3, publishedRevision: 2 } } }));
    await render(); await publish();
    expect(container.querySelector('[role="status"]')?.textContent).toContain(outcome.message);
    expect(container.textContent).not.toContain("latest approved schedule and crew are published");
    expect(refresh).toHaveBeenCalledOnce();
    if (outcome.states.partial) expect(container.textContent).toContain("1 partially synchronized");
  });
  it("reports an already published latest revision without requiring a processed job", async () => {
    mocks.fetch.mockImplementation(async () => Response.json({ success: true, data: { ...published(), processed: 0, published: 0, states: {}, flight: { ...published().flight, message: "This latest approved revision is already published to IF." } } }));
    await render(); await publish();
    expect(container.textContent).toContain("already published to IF"); expect(refresh).toHaveBeenCalledOnce();
  });
  it("shows the provider retry deadline in accessible UTC text without claiming publishing succeeded", async () => {
    const nextAttemptAt = "2026-10-05T19:23:00.000Z";
    mocks.fetch.mockImplementation(async () => Response.json({ success: true, data: { ...published(), processed: 0, published: 0, states: { queued: 1 }, flight: { ...published().flight, state: "queued", publishedRevision: 2, message: "IF rate limited publishing. Try publishing after the displayed retry time.", nextAttemptAt } } }));
    await render(); await publish();
    const deadline = container.querySelector("time")!;
    expect(deadline.getAttribute("dateTime")).toBe(nextAttemptAt);
    expect(deadline.parentElement?.getAttribute("role")).toBe("status");
    expect(deadline.parentElement?.textContent).toBe("Retry after 05 Oct 2026, 19:23 UTC.");
    expect(container.textContent).not.toContain("latest approved schedule and crew are published");
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("ignores an invalid retry timestamp", async () => {
    mocks.fetch.mockImplementation(async () => Response.json({ success: true, data: { ...published(), flight: { ...published().flight, nextAttemptAt: "invalid-date" } } }));
    await render(); await publish();
    expect(container.querySelector("time")).toBeNull();
    expect(container.textContent).not.toContain("Retry after");
    expect(container.textContent).not.toContain("Invalid Date");
  });
  it("does not infer latest-flight success from an older synchronized job count", async () => {
    mocks.fetch.mockImplementation(async () => Response.json({ success: true, data: { processed: 1, published: 1, disabled: false, states: { published: 1 } } }));
    await render(); await publish();
    expect(container.textContent).toContain("Refresh the flight to confirm its latest approved revision");
    expect(container.textContent).not.toContain("latest approved schedule and crew are published");
  });
  it.each([401, 403])("notifies the parent and refreshes protected state after authorization denial (%s)", async status => {
    mocks.fetch.mockImplementation(async () => Response.json({ success: false, error: "Scheduling admin permission required" }, { status }));
    await render(); await publish();
    expect(denied).toHaveBeenCalledOnce(); expect(refresh).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Scheduling admin permission required");
  });
  it("preserves the publishing result when local flight refresh fails", async () => {
    refresh.mockRejectedValueOnce(new Error("Local refresh unavailable"));
    await render(); await publish();
    expect(container.querySelector('[role="status"]')?.textContent).toContain("latest approved schedule and crew are published");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Local refresh unavailable");
  });
  it("ignores a previous flight response after selection changes and never publishes the new selection automatically", async () => {
    let release!: (response: Response) => void;
    let signal!: AbortSignal;
    mocks.fetch.mockImplementation((_path: string, options: RequestInit) => {
      signal = options.signal as AbortSignal;
      return new Promise<Response>(resolve => { release = resolve; });
    });
    await render(); await publish();
    await render(28);
    expect(signal.aborted).toBe(true); expect(button().disabled).toBe(false);
    await act(async () => release(Response.json({ success: true, data: published() })));
    expect(mocks.fetch).toHaveBeenCalledOnce(); expect(refresh).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')).toBeNull(); expect(container.querySelector('[role="alert"]')).toBeNull();
  });
  it("aborts a slow request after twenty-five seconds and requires outcome review before a retry", async () => {
    vi.useFakeTimers();
    mocks.fetch.mockImplementation((_path: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => options.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))));
    await render(); await publish();
    await act(async () => vi.advanceTimersByTime(25000));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("check the outcome before retrying");
    expect(button().disabled).toBe(false); expect(busy).toHaveBeenLastCalledWith(false);
    expect(refresh).not.toHaveBeenCalled(); expect(mocks.fetch).toHaveBeenCalledOnce();
  });
  it("honors the parent disabled state without sending a request", async () => {
    await render(27, true); await publish();
    expect(mocks.fetch).not.toHaveBeenCalled(); expect(button().disabled).toBe(true);
  });
});
