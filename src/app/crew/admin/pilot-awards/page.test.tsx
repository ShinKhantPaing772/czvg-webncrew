// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
}));

vi.mock("@/lib/utils/api", () => ({
  authFetch: mocks.authFetch,
}));

vi.mock("@/components/crew-header", () => ({
  CrewHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("next/image", () => ({
  default: ({ unoptimized, ...props }: any) => <img {...props} />,
}));

import PilotAwardsPage from "./page";

let container: HTMLDivElement;
let root: Root | null = null;

const mockPilots = [
  {
    id: 1,
    name: "Alice Wang",
    callsign: "CSN101",
    ifc: "AliceW",
    email: "alice@example.com",
    status: 1,
    grants: [{ awardId: 10, dateAwarded: "2026-01-01" }],
  },
  {
    id: 2,
    name: "Bob Zhang",
    callsign: "CSN102",
    ifc: "BobZ",
    email: "bob@example.com",
    status: 1,
    grants: [],
  },
  {
    id: 3,
    name: "Charlie Li",
    callsign: "CSN103",
    ifc: "CharlieL",
    email: "charlie@example.com",
    status: 1,
    grants: [],
  },
];

const mockAwards = [
  {
    id: 10,
    name: "Canton Route Master",
    description: "Completed 50+ intercontinental flights",
    imageurl: "https://example.com/badge10.png",
  },
  {
    id: 20,
    name: "Daxing Wing Pioneer",
    description: "Participated in Daxing inaugural event",
    imageurl: "https://example.com/badge20.png",
  },
];

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  mocks.authFetch.mockReset().mockImplementation(async (url: string, options?: RequestInit) => {
    if (url.includes("/api/admin/pilot-awards?awardId=")) {
      return {
        ok: true,
        json: async () => ({
          award: mockAwards[0],
          recipients: [
            {
              id: 1,
              name: "Alice Wang",
              callsign: "CSN101",
              ifc: "AliceW",
              email: "alice@example.com",
              status: 1,
              dateAwarded: "2026-01-01T00:00:00.000Z",
            },
          ],
        }),
      };
    }

    if (url.includes("/api/admin/pilot-awards") && options?.method === "POST") {
      return {
        ok: true,
        json: async () => ({
          success: true,
          createdCount: 2,
          message: "Awards granted",
        }),
      };
    }

    if (url.includes("/api/admin/pilot-awards") && options?.method === "DELETE") {
      return {
        ok: true,
        json: async () => ({
          success: true,
          deletedCount: 1,
          message: "Award revoked",
        }),
      };
    }

    // Default GET pilot-awards
    return {
      ok: true,
      json: async () => ({
        pilots: mockPilots,
        awards: mockAwards,
      }),
    };
  });
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  container.remove();
});

describe("PilotAwardsPage self-acceptance", () => {
  it("renders loaded pilots and awards", async () => {
    await act(async () => {
      root!.render(<PilotAwardsPage />);
    });

    expect(container.textContent).toContain("Alice Wang");
    expect(container.textContent).toContain("Bob Zhang");
    expect(container.textContent).toContain("Charlie Li");
    expect(container.textContent).toContain("Assign by pilot");
    expect(container.textContent).toContain("Browse by award");
  });

  it("supports batch selecting multiple pilots and granting awards at once in Tab 1", async () => {
    await act(async () => {
      root!.render(<PilotAwardsPage />);
    });

    // 1. Click "Multi-select" button to enter Batch Mode
    const multiSelectBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Multi-select"),
    );
    expect(multiSelectBtn).toBeDefined();

    await act(async () => {
      multiSelectBtn!.click();
    });

    expect(container.textContent).toContain("Batch Mode");
    expect(container.textContent).toContain("Select all visible");

    // 2. Select Bob (id 2) and Charlie (id 3)
    const pilotItems = Array.from(container.querySelectorAll(".cursor-pointer")).filter(
      (el) => el.textContent?.includes("CSN102") || el.textContent?.includes("CSN103"),
    );
    expect(pilotItems.length).toBe(2);

    for (const item of pilotItems) {
      await act(async () => {
        (item as HTMLElement).click();
      });
    }

    expect(container.textContent).toContain("2 pilots selected");
    expect(container.textContent).toContain("Target Pilots (2)");
    expect(container.textContent).toContain("Bob Zhang (CSN102)");
    expect(container.textContent).toContain("Charlie Li (CSN103)");

    // 3. Select an award (Daxing Wing Pioneer - id 20)
    const awardCheckbox = container.querySelector("#batch-award-20") as HTMLInputElement;
    expect(awardCheckbox).toBeDefined();

    await act(async () => {
      awardCheckbox.click();
    });

    // 4. Click the "Grant Awards (1) to 2 Pilots" button
    const grantBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Grant Awards"),
    );
    expect(grantBtn).toBeDefined();
    expect(grantBtn!.disabled).toBe(false);

    await act(async () => {
      grantBtn!.click();
    });

    // Verify POST was dispatched with multiple pilots
    expect(mocks.authFetch).toHaveBeenCalledWith(
      "/api/admin/pilot-awards",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          pilotIds: [2, 3],
          awardIds: [20],
        }),
      }),
    );
  });

  it("supports granting an award to multiple pilots via Tab 2 modal dialog", async () => {
    await act(async () => {
      root!.render(<PilotAwardsPage />);
    });

    // 1. Switch to "Browse by award" tab
    const browseTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (t) => t.textContent?.includes("Browse by award"),
    );
    expect(browseTab).toBeDefined();

    await act(async () => {
      browseTab!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
      browseTab!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      browseTab!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    // 2. Select the first award: Canton Route Master (id 10)
    const awardButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Canton Route Master"),
    );
    expect(awardButton).toBeDefined();

    await act(async () => {
      awardButton!.click();
    });

    // Should show Alice Wang as an existing recipient
    expect(container.textContent).toContain("Pilots with Canton Route Master");
    expect(container.textContent).toContain("1 pilot");
    expect(container.textContent).toContain("Alice Wang");

    // 3. Click "Grant to Pilots" button to open modal
    const grantToPilotsBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Grant to Pilots"),
    );
    expect(grantToPilotsBtn).toBeDefined();

    await act(async () => {
      grantToPilotsBtn!.click();
    });

    // Modal opens
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).toBeDefined();
    expect(dialog?.textContent).toContain('Grant "Canton Route Master" to Pilots');

    // 4. In modal, Alice already has it (hidden by default or disabled). Bob and Charlie are available.
    // Click "Select all eligible"
    const selectAllEligibleBtn = Array.from(dialog!.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Select all eligible"),
    );
    expect(selectAllEligibleBtn).toBeDefined();

    await act(async () => {
      selectAllEligibleBtn!.click();
    });

    expect(dialog?.textContent).toContain("2 pilots selected");

    // 5. Submit grant modal
    const confirmGrantBtn = Array.from(dialog!.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Grant Award (2)"),
    );
    expect(confirmGrantBtn).toBeDefined();

    await act(async () => {
      confirmGrantBtn!.click();
    });

    // Verify POST was dispatched with the awardId and both pilot IDs
    expect(mocks.authFetch).toHaveBeenCalledWith(
      "/api/admin/pilot-awards",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          pilotIds: [2, 3],
          awardId: 10,
        }),
      }),
    );
  });

  it("supports revoking an award from a recipient in Tab 2", async () => {
    await act(async () => {
      root!.render(<PilotAwardsPage />);
    });

    // 1. Switch to Tab 2
    const browseTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (t) => t.textContent?.includes("Browse by award"),
    );
    await act(async () => {
      browseTab!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
      browseTab!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      browseTab!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    // 2. Select Canton Route Master (id 10)
    const awardButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Canton Route Master"),
    );
    await act(async () => {
      awardButton!.click();
    });

    expect(container.textContent).toContain("Alice Wang");

    // 3. Click the revoke button for Alice
    const revokeTrigger = container.querySelector('button[title="Revoke award"]') as HTMLButtonElement;
    expect(revokeTrigger).toBeDefined();

    await act(async () => {
      revokeTrigger.click();
    });

    // Confirmation dialog opens
    const confirmDialog = document.body.querySelector('[role="alertdialog"]');
    expect(confirmDialog).toBeDefined();
    expect(confirmDialog?.textContent).toContain("Revoke award from Alice Wang?");

    const confirmRevokeBtn = Array.from(confirmDialog!.querySelectorAll("button")).find(
      (b) => b.textContent === "Revoke",
    );
    expect(confirmRevokeBtn).toBeDefined();

    await act(async () => {
      confirmRevokeBtn!.click();
    });

    // Verify DELETE was dispatched
    expect(mocks.authFetch).toHaveBeenCalledWith(
      "/api/admin/pilot-awards?awardId=10&pilotId=1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
