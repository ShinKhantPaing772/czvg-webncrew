// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/utils/api", () => ({ authFetch: mocks.fetch }));
import { InfiniteFlightPanel } from "./infinite-flight-panel";
import type { LiveAircraft, ScheduledFlight } from "./types";

const ready = {
  enabled: true, configured: true, autoPublishEnabled: false, durableBindingsAllowed: false,
  disabledReasons: [], canDisconnect: true, connection: null,
  revocationConfigured: true, publishingReady: false, publishingDisabledReasons: ["Automatic IF publishing is disabled"], disconnectMode: "revoke",
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
  oauthSetup: { ...ready.oauthSetup, checks: ready.oauthSetup.checks.map(check => ({ ...check, ready: check.id !== "revocation" })) },
};
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.history.replaceState(null, "", "/crew/admin/scheduling");
  mocks.fetch.mockImplementation(async () => Response.json({ success: true, data: ready }));
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); vi.resetAllMocks(); vi.unstubAllGlobals();
});
async function render(aircraft: LiveAircraft[] = [], flights: ScheduledFlight[] = []) {
  await act(async () => root.render(<InfiniteFlightPanel aircraft={aircraft} flights={flights} onRefresh={vi.fn()} />));
}
function button(label: string) {
  return Array.from(document.querySelectorAll("button")).find((item) => item.textContent?.trim() === label)!;
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
    expect(container.textContent).toContain("Enable automatic publishing");
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

  it("permits temporary reads but blocks linking and recovery when publishing requires revocation", async () => {
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
    expect((container.querySelector('[aria-label="Local aircraft for C-TEST"]') as HTMLSelectElement).disabled).toBe(true);
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
});
