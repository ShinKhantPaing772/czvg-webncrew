// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/utils/api", () => ({ authFetch: mocks.fetch }));
import { InfiniteFlightPanel } from "./infinite-flight-panel";
import type { LiveAircraft, ScheduledFlight, SchedulingData } from "./types";

const ready = {
  enabled: true, configured: true, autoPublishEnabled: false, durableBindingsAllowed: false,
  disabledReasons: [], canDisconnect: true, connection: null,
  revocationConfigured: true, publishingReady: false, publishingDisabledReasons: ["Automatic IF publishing is disabled"], disconnectMode: "revoke",
  bindingReady: false, bindingDisabledReasons: ["Durable IF mapping retention has not been authorized"],
  oauthSetup: {
    callbackUrl: "https://ifczvg.com/oauth/callback",
    checks: [
      { id: "preview", label: "Preview access enabled", ready: true, required: true },
      { id: "client", label: "OAuth client configured", ready: true, required: true },
      { id: "callback", label: "Registered callback configured", ready: true, required: true },
      { id: "revocation", label: "Supported revocation configured", ready: true, required: false },
      { id: "encryption", label: "Token encryption configured", ready: true, required: true },
    ],
  },
};
const noRevocation = {
  ...ready, revocationConfigured: false, disconnectMode: "local", autoPublishEnabled: true, durableBindingsAllowed: true,
  publishingReady: false, publishingDisabledReasons: ["Automatic IF publishing requires a supported OAuth revocation URL"],
  bindingReady: true, bindingDisabledReasons: [] as string[],
  oauthSetup: { ...ready.oauthSetup, checks: ready.oauthSetup.checks.map(check => ({ ...check, ready: check.id !== "revocation" })) },
};
let root: Root;
let container: HTMLDivElement;
const refresh = vi.fn(async () => {});
const catalog: SchedulingData["catalog"] = [{ id: 1, name: "Airbus A320", liveryname: "Our airline" }];
const organizationId = "12345678-1234-1234-1234-123456789abc";
const remoteAircraft = { id: "12345678-1234-1234-1234-123456789abd", aircraftId: "type", organizationId, registration: "C-TEST", isFleetActiveSlot: true, visibility: 1 };
const bindingReady = { ...noRevocation, autoPublishEnabled: false, connection: { state: "connected", organizationId, expiresAt: null } };

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  window.history.replaceState(null, "", "/crew/admin/scheduling");
  mocks.fetch.mockImplementation(async () => Response.json({ success: true, data: ready }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.resetAllMocks(); vi.unstubAllGlobals();
});
async function render(aircraft: LiveAircraft[] = [], flights: ScheduledFlight[] = [], aircraftCatalog: SchedulingData["catalog"] = []) {
  await act(async () => root.render(<InfiniteFlightPanel aircraft={aircraft} flights={flights} catalog={aircraftCatalog} onRefresh={refresh} />));
}
function button(label: string) {
  return Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.trim() === label)!;
}
async function change(id: string, value: string) {
  const field = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
  await act(async () => {
    if (field instanceof HTMLSelectElement) {
      field.value = value; field.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}
async function fillAircraft() {
  await change("tail-registration", "C-OWN"); await change("tail-catalog", "1"); await change("tail-airport", "CYYZ");
}
function mockFleet(status = bindingReady, remote = remoteAircraft) {
  mocks.fetch.mockImplementation(async (path: string) => Response.json(path === "/api/admin/scheduling"
    ? { success: true }
    : path.includes("/fleet?") ? { success: true, data: { aircraft: [remote] } }
    : path.endsWith("/fleet") ? { success: true, data: { organizations: [{ id: organizationId, name: "Our org" }] } }
    : { success: true, data: status }));
}

describe("Infinite Flight organization linking", () => {
  it("allows OAuth linking while automatic publishing and durable bindings are disabled", async () => {
    await render();
    expect(button("Connect Infinite Flight").disabled).toBe(false);
    expect(container.textContent).toContain("https://ifczvg.com/oauth/callback");
    expect(container.textContent).toContain("Automatic publishing is currently disabled");
    expect(container.textContent).toContain("your pilots use the existing site login");
  });

  it("blocks connecting and shows which server setup is required", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ success: true, data: {
      ...ready, configured: false, canDisconnect: false,
      oauthSetup: { ...ready.oauthSetup, checks: ready.oauthSetup.checks.map((item) => ({ ...item, ready: item.id !== "client" })) },
    } }));
    await render();
    expect(button("Connect Infinite Flight").disabled).toBe(true);
    expect(container.textContent).toContain("OAuth client configured: required");
    expect(container.querySelector('a[href*="v3-oauth-live-preview"]')).not.toBeNull();
  });

  it("permits disconnecting an existing grant after preview access is disabled", async () => {
    let disconnected = false;
    mocks.fetch.mockImplementation(async (path: string) => {
      if (path.endsWith("/disconnect")) { disconnected = true; return Response.json({ success: true, revocation: "revoked" }); }
      return Response.json({ success: true, data: {
        ...ready, enabled: false, configured: false,
        connection: disconnected ? null : { state: "reauth_required", organizationId: null, expiresAt: null },
      } });
    });
    await render();
    expect(button("Disconnect").disabled).toBe(false);
    await act(async () => button("Disconnect").click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Disconnect Infinite Flight?");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("revokes the saved IF authorization");
    const confirm = Array.from(document.querySelectorAll('[role="dialog"] button')).find((item) => item.textContent === "Disconnect") as HTMLButtonElement;
    await act(async () => confirm.click());
    expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/scheduling/if/disconnect", expect.objectContaining({ method: "POST" }));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).toContain("Infinite Flight disconnected");
    expect(container.textContent).toContain("authorization revoked");
    expect(button("Connect Infinite Flight").disabled).toBe(true);
  });

  it("keeps a failed disconnect visible inside the open dialog for retry", async () => {
    mocks.fetch.mockImplementation(async (path: string) => path.endsWith("/disconnect")
      ? Response.json({ success: false, error: "IF revocation was not confirmed; retry disconnect" }, { status: 502 })
      : Response.json({ success: true, data: { ...ready, connection: { state: "connected", organizationId: null, expiresAt: null } } }));
    await render();
    await act(async () => button("Disconnect").click());
    const confirm = Array.from(document.querySelectorAll('[role="dialog"] button')).find((item) => item.textContent === "Disconnect") as HTMLButtonElement;
    await act(async () => confirm.click());
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain("IF revocation was not confirmed");
    expect(confirm.disabled).toBe(false);
  });

  it("blocks a configured revocation when its original client setup is unavailable", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ success: true, data: {
      ...ready, canDisconnect: false, connection: { state: "connected", organizationId: null, expiresAt: null },
    } }));
    await render();
    expect(button("Disconnect").disabled).toBe(true);
    expect(container.textContent).toContain("supported IF revocation URL");
  });

  it("disables IF reads when preview access is paused while keeping disconnect available", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ success: true, data: {
      ...ready, enabled: false, configured: false,
      connection: { state: "connected", organizationId: "12345678-1234-1234-1234-123456789abc", expiresAt: null },
    } }));
    await render();
    expect(button("Load organizations").disabled).toBe(true);
    expect(button("Load IF fleet").disabled).toBe(true);
    expect(button("Disconnect").disabled).toBe(false);
  });

  it("explains an expired callback and removes consumed callback fields from the address", async () => {
    window.history.replaceState(null, "", "/crew/admin/scheduling?filter=crew&if=error&reason=oauth_state#fleet");
    await render();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("connection request expired");
    expect(window.location.search).toBe("?filter=crew"); expect(window.location.hash).toBe("#fleet");
  });

  it("uses fixed messages for unknown callback reasons", async () => {
    window.history.replaceState(null, "", "/crew/admin/scheduling?if=error&reason=secret-provider-body");
    await render();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("authorization did not complete");
    expect(container.textContent).not.toContain("secret-provider-body");
  });

  it("confirms a successful callback without requiring publishing activation", async () => {
    window.history.replaceState(null, "", "/crew/admin/scheduling?if=connected");
    await render();
    expect(container.textContent).toContain("Infinite Flight connected. Load organizations");
    expect(window.location.search).toBe("");
  });

  it("allows temporary fleet reads while aircraft linking is disabled for OAuth testing", async () => {
    const organizationId = "12345678-1234-1234-1234-123456789abc";
    mocks.fetch.mockImplementation(async (path: string) => Response.json(path.includes("/fleet?") ? {
      success: true, data: { aircraft: [{ id: "remote-tail", aircraftId: "type", organizationId, registration: "C-TEST", isFleetActiveSlot: true, visibility: 0 }] },
    } : { success: true, data: { ...ready, connection: { state: "connected", organizationId, expiresAt: null } } }));
    await render();
    expect(button("Load IF fleet").disabled).toBe(false);
    await act(async () => button("Load IF fleet").click());
    expect(container.textContent).toContain("C-TEST");
    expect(button("Link aircraft").disabled).toBe(true);
    expect(container.textContent).toContain("IF permission to save the aircraft identifiers");
  });

  it("allows connecting without a revocation URL and presents revocation as optional", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ success: true, data: noRevocation }));
    await render();
    expect(button("Connect Infinite Flight").disabled).toBe(false);
    expect(container.textContent).toContain("Supported revocation configured: optional — unavailable");
    expect(container.textContent).not.toContain("Supported revocation configured: required");
    expect(container.textContent).toContain("Automatic publishing is currently disabled");
    expect(container.textContent).not.toContain("Automatic publishing is enabled");
    expect(container.textContent).toContain("requires a supported OAuth revocation URL");
  });

  it("keeps binding and temporary reads available while recovery requires publishing readiness", async () => {
    const organizationId = "12345678-1234-1234-1234-123456789abc";
    const remoteId = "remote-tail";
    const tail: LiveAircraft = { id: 1, aircraft_id: 1, registration: "C-LOCAL", name: "Airbus A320", active: true, current_airport: "CYYZ", if_aircraft_id: remoteId };
    const flight: ScheduledFlight = { id: 1, public_id: "public", live_aircraft_id: 1, captain_id: 1, departure: "CYYZ", arrival: "CYVR", scheduled_departure: "2026-10-04T10:00:00Z", scheduled_arrival: "2026-10-04T15:00:00Z", status: "approved", revision: 1, if_schedule_id: "remote-schedule", publishing_state: "failed", captain: { id: 1, name: "Captain", callsign: "WNC1" }, members: [] };
    const remote = { id: remoteId, aircraftId: "type", organizationId, registration: "C-TEST", isFleetActiveSlot: true, visibility: 1 };
    mocks.fetch.mockImplementation(async (path: string) => Response.json(path.includes("&aircraftId=")
      ? { success: true, data: { aircraft: remote, position: null, schedules: [] } }
      : path.includes("/fleet?") ? { success: true, data: { aircraft: [remote] } }
      : { success: true, data: { ...noRevocation, connection: { state: "connected", organizationId, expiresAt: null } } }));
    await render([tail], [flight]);
    expect(button("Load organizations").disabled).toBe(false);
    expect(button("Load IF fleet").disabled).toBe(false);
    expect(button("Disconnect").disabled).toBe(false);
    await act(async () => button("Load IF fleet").click());
    expect(button("Link aircraft").disabled).toBe(true);
    expect((container.querySelector('[aria-label="Local aircraft for C-TEST"]') as HTMLSelectElement).disabled).toBe(false);
    expect(button("View IF status").disabled).toBe(false);
    await act(async () => button("View IF status").click());
    expect(button("Retry or reconcile").disabled).toBe(true);
    expect(button("Review recreation").disabled).toBe(true);
    expect(container.textContent).toContain("Automatic publishing is currently disabled");
  });

  it("explains local-only disconnect and reports that it did not revoke IF authorization", async () => {
    let disconnected = false;
    mocks.fetch.mockImplementation(async (path: string) => {
      if (path.endsWith("/disconnect")) { disconnected = true; return Response.json({ success: true, revocation: "local_only" }); }
      return Response.json({ success: true, data: { ...noRevocation, connection: disconnected ? null : { state: "connected", organizationId: null, expiresAt: null } } });
    });
    await render();
    await act(async () => button("Disconnect").click());
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("only the Crew Center’s saved IF credentials");
    expect(dialog.textContent).toContain("does not revoke your authorization at Infinite Flight");
    const confirm = Array.from(dialog.querySelectorAll("button")).find(item => item.textContent === "Disconnect") as HTMLButtonElement;
    await act(async () => confirm.click());
    expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/scheduling/if/disconnect", expect.objectContaining({ method: "POST" }));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).toContain("saved IF credentials were removed");
    expect(container.textContent).toContain("authorization was not revoked at Infinite Flight");
    expect(container.textContent).not.toContain("authorization revoked");
    expect(button("Connect Infinite Flight").disabled).toBe(false);
  });

  it("uses the actual disconnect outcome when revocation configuration changes after status was loaded", async () => {
    let disconnected = false;
    mocks.fetch.mockImplementation(async (path: string) => {
      if (path.endsWith("/disconnect")) { disconnected = true; return Response.json({ success: true, revocation: "local_only" }); }
      return Response.json({ success: true, data: { ...ready, connection: disconnected ? null : { state: "connected", organizationId: null, expiresAt: null } } });
    });
    await render(); await act(async () => button("Disconnect").click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("revokes the saved IF authorization");
    const confirm = Array.from(document.querySelectorAll('[role="dialog"] button')).find(item => item.textContent === "Disconnect") as HTMLButtonElement;
    await act(async () => confirm.click());
    expect(container.textContent).toContain("authorization was not revoked at Infinite Flight");
    expect(container.textContent).not.toContain("authorization revoked");
  });

  it("creates and links a locally authored aircraft while automatic publishing and revocation are disabled", async () => {
    mockFleet(); await render([], [], catalog);
    await act(async () => button("Load IF fleet").click());
    expect(button("Add to local fleet").disabled).toBe(false);
    await act(async () => button("Add to local fleet").click());
    const registration = document.getElementById("tail-registration") as HTMLInputElement;
    expect(registration.value).toBe(""); expect(registration.placeholder).toBe("C-TEST");
    expect(document.getElementById("tail-if-link")?.getAttribute("aria-checked")).toBe("true");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Flights for a linked aircraft must be published");
    await fillAircraft(); await act(async () => button("Add aircraft").click());
    const request = mocks.fetch.mock.calls.find(call => call[0] === "/api/admin/scheduling")!;
    expect(request[1].method).toBe("POST");
    expect(JSON.parse(request[1].body)).toEqual({ action: "add_aircraft", registration: "C-OWN", aircraft_id: 1, current_airport: "CYYZ", active: true, if_aircraft_id: remoteAircraft.id });
    expect(refresh).toHaveBeenCalledOnce(); expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).toContain("Aircraft added to the local fleet and linked to Infinite Flight");
  });

  it("permits unlinked creation when durable IF bindings are unavailable and sends no IF identifier", async () => {
    mockFleet({ ...bindingReady, bindingReady: false, durableBindingsAllowed: false, bindingDisabledReasons: ["Durable IF mapping retention has not been authorized"] });
    await render([], [], catalog); await act(async () => button("Load IF fleet").click());
    expect(button("Add to local fleet").disabled).toBe(false);
    await act(async () => button("Add to local fleet").click());
    const link = document.getElementById("tail-if-link") as HTMLButtonElement;
    expect(link.disabled).toBe(true); expect(link.getAttribute("aria-checked")).toBe("false");
    await fillAircraft(); await act(async () => button("Add aircraft").click());
    const request = mocks.fetch.mock.calls.find(call => call[0] === "/api/admin/scheduling")!;
    expect(JSON.parse(request[1].body)).toEqual({ action: "add_aircraft", registration: "C-OWN", aircraft_id: 1, current_airport: "CYYZ", active: true });
    expect(container.textContent).toContain("Aircraft added to the local fleet for manual scheduling");
  });

  it("lets an admin choose local scheduling even when IF binding is available", async () => {
    mockFleet(); await render([], [], catalog); await act(async () => button("Load IF fleet").click());
    await act(async () => button("Add to local fleet").click());
    await act(async () => (document.getElementById("tail-if-link") as HTMLButtonElement).click());
    await fillAircraft(); await act(async () => button("Add aircraft").click());
    const request = mocks.fetch.mock.calls.find(call => call[0] === "/api/admin/scheduling")!;
    expect(JSON.parse(request[1].body)).not.toHaveProperty("if_aircraft_id");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("switches an open form to manual creation when refreshed binding permission is removed", async () => {
    let bindingAllowed = true;
    mocks.fetch.mockImplementation(async (path: string) => Response.json(path === "/api/admin/scheduling"
      ? { success: true }
      : path.includes("/fleet?") ? { success: true, data: { aircraft: [remoteAircraft] } }
      : { success: true, data: { ...bindingReady, bindingReady: bindingAllowed, durableBindingsAllowed: bindingAllowed, bindingDisabledReasons: bindingAllowed ? [] : ["Durable IF mapping retention has not been authorized"] } }));
    await render([], [], catalog); await act(async () => button("Load IF fleet").click());
    await act(async () => button("Add to local fleet").click()); await fillAircraft();
    expect(document.getElementById("tail-if-link")?.getAttribute("aria-checked")).toBe("true");

    bindingAllowed = false;
    await act(async () => window.dispatchEvent(new Event("focus")));
    const link = document.getElementById("tail-if-link") as HTMLButtonElement;
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(link.disabled).toBe(true); expect(link.getAttribute("aria-checked")).toBe("false");
    expect((document.getElementById("tail-registration") as HTMLInputElement).value).toBe("C-OWN");
    expect(button("Add aircraft").disabled).toBe(false);
    await act(async () => button("Add aircraft").click());

    const request = mocks.fetch.mock.calls.find(call => call[0] === "/api/admin/scheduling")!;
    expect(JSON.parse(request[1].body)).toEqual({ action: "add_aircraft", registration: "C-OWN", aircraft_id: 1, current_airport: "CYYZ", active: true });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).toContain("Aircraft added to the local fleet for manual scheduling");
  });

  it("selects an existing registration case-insensitively and links it without creating a duplicate", async () => {
    const tail: LiveAircraft = { id: 1, aircraft_id: 1, registration: "c-test", name: "Airbus A320", active: true, current_airport: "CYYZ" };
    mockFleet(); await render([tail], [], catalog); await act(async () => button("Load IF fleet").click());
    expect(container.textContent).toContain("Already in local fleet");
    expect(button("Add to local fleet")).toBeUndefined();
    expect((container.querySelector('[aria-label="Local aircraft for C-TEST"]') as HTMLSelectElement).value).toBe("1");
    expect(button("Link aircraft").disabled).toBe(false);
    await act(async () => button("Link aircraft").click());
    const request = mocks.fetch.mock.calls.find(call => call[0] === "/api/admin/scheduling")!;
    expect(request[1].method).toBe("PATCH");
    expect(JSON.parse(request[1].body)).toEqual({ action: "edit_aircraft", live_aircraft_id: 1, if_aircraft_id: remoteAircraft.id });
    expect(container.textContent).toContain("C-TEST linked to the local fleet");
  });

  it("keeps failed creation in the form and permits a corrected retry", async () => {
    let attempts = 0;
    mocks.fetch.mockImplementation(async (path: string) => path === "/api/admin/scheduling"
      ? ++attempts === 1 ? Response.json({ success: false, error: "Selected IF aircraft differs from the local catalog" }, { status: 409 }) : Response.json({ success: true })
      : Response.json(path.includes("/fleet?") ? { success: true, data: { aircraft: [remoteAircraft] } } : { success: true, data: bindingReady }));
    await render([], [], catalog); await act(async () => button("Load IF fleet").click());
    await act(async () => button("Add to local fleet").click()); await fillAircraft();
    await act(async () => button("Add aircraft").click());
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain("differs from the local catalog");
    expect((document.getElementById("tail-registration") as HTMLInputElement).value).toBe("C-OWN");
    expect(button("Add aircraft").disabled).toBe(false); expect(refresh).not.toHaveBeenCalled();
    await act(async () => (document.getElementById("tail-if-link") as HTMLButtonElement).click());
    await act(async () => button("Add aircraft").click());
    const requests = mocks.fetch.mock.calls.filter(call => call[0] === "/api/admin/scheduling");
    expect(requests).toHaveLength(2); expect(JSON.parse(requests[1][1].body)).not.toHaveProperty("if_aircraft_id");
    expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps aircraft linking disabled until the viewed organization is saved while allowing local creation", async () => {
    mockFleet({ ...bindingReady, connection: { ...bindingReady.connection, organizationId: "different-org" } });
    await render([], [], catalog); await act(async () => button("Load organizations").click());
    await change("if-organization", organizationId); await act(async () => button("Load IF fleet").click());
    expect((container.querySelector('[aria-label="Local aircraft for C-TEST"]') as HTMLSelectElement).disabled).toBe(true);
    expect(button("Add to local fleet").disabled).toBe(false);
    expect(container.textContent).toContain("Save this organization before linking");
    await act(async () => button("Add to local fleet").click());
    expect((document.getElementById("tail-if-link") as HTMLButtonElement).disabled).toBe(true);
  });

  it("requires a local catalog before opening an IF fleet creation form", async () => {
    mockFleet(); await render(); await act(async () => button("Load IF fleet").click());
    expect(button("Add to local fleet").disabled).toBe(true);
    expect(container.textContent).toContain("Add an aircraft type to the local catalog");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("allows local creation from an IF aircraft in storage without offering an IF binding", async () => {
    mockFleet(bindingReady, { ...remoteAircraft, isFleetActiveSlot: false });
    await render([], [], catalog); await act(async () => button("Load IF fleet").click());
    expect(container.textContent).toContain("IF fleet aircraft in storage");
    expect((container.querySelector('[aria-label="Local aircraft for C-TEST"]') as HTMLSelectElement).disabled).toBe(true);
    expect(button("Add to local fleet").disabled).toBe(false);
    await act(async () => button("Add to local fleet").click());
    expect((document.getElementById("tail-if-link") as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById("tail-if-link")?.getAttribute("aria-checked")).toBe("false");
  });

  it("closes a creation form when a refreshed status reports the IF account disconnected", async () => {
    vi.useFakeTimers();
    try {
      let disconnected = false;
      mocks.fetch.mockImplementation(async (path: string) => Response.json(path.includes("/fleet?")
        ? { success: true, data: { aircraft: [remoteAircraft] } }
        : { success: true, data: { ...bindingReady, connection: disconnected ? { ...bindingReady.connection, state: "disconnected" } : bindingReady.connection } }));
      await render([], [], catalog); await act(async () => button("Load IF fleet").click());
      await act(async () => button("Add to local fleet").click()); expect(document.querySelector('[role="dialog"]')).not.toBeNull();
      disconnected = true; await act(async () => vi.advanceTimersByTimeAsync(30_001));
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(mocks.fetch.mock.calls.some(call => call[0] === "/api/admin/scheduling")).toBe(false);
    } finally { vi.useRealTimers(); }
  });

  it("closes the creation form when its temporary IF fleet view expires", async () => {
    vi.useFakeTimers();
    try {
      mockFleet(); await render([], [], catalog); await act(async () => button("Load IF fleet").click());
      await act(async () => button("Add to local fleet").click()); expect(document.querySelector('[role="dialog"]')).not.toBeNull();
      await act(async () => vi.advanceTimersByTimeAsync(60_001));
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(container.textContent).toContain("IF fleet view expired");
      expect(mocks.fetch.mock.calls.some(call => call[0] === "/api/admin/scheduling")).toBe(false);
    } finally { vi.useRealTimers(); }
  });
});
