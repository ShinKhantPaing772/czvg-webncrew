// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams("pirepId=123"),
}));
const router = { replace: mocks.replace };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => mocks.searchParams,
}));
vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ user: { id: 42 } }),
}));
vi.mock("@/lib/utils/api", () => ({ authFetch: mocks.authFetch }));
vi.mock("@/components/crew-header", () => ({
  CrewHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (en: string) => en }),
}));

import ViewPireps from "./page";

const linkedPirep = {
  id: 123,
  flightnum: "CZ123",
  departure: "ZGGG",
  arrival: "ZPPP",
  flighttime: "01:45",
  date: "2026-10-01",
  Aircraft: { name: "Airbus A321", liveryname: "China Southern" },
  fuelused: 3200,
  multi: "None",
  status: 1,
  Comments: [{ id: 7, userid: 1, content: "Staff reviewed this report", dateposted: "2026-10-02" }],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.searchParams = new URLSearchParams("pirepId=123");
  mocks.authFetch.mockImplementation(async (url: string, options?: RequestInit) => {
    if (options?.method === "POST") {
      return Response.json({ success: true, comment: {
        id: 8, userid: 42, content: "Thank you", dateposted: "2026-10-03",
      } });
    }
    if (url.includes("pirepId=")) return Response.json({ pirep: linkedPirep });
    return Response.json({
      pireps: [{ ...linkedPirep, id: 200, flightnum: "CZ200" }],
      pagination: { total: 20, totalPages: 2, currentPage: 1, limit: 10 },
    });
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function button(label: string) {
  return Array.from(document.querySelectorAll("button")).find(
    item => item.textContent?.trim() === label,
  )!;
}

describe("PIREP details from the home page", () => {
  it("opens a linked report outside the current list and stays closed after dismissal", async () => {
    await act(async () => root.render(<ViewPireps />));

    expect(container.textContent).toContain("CZ200");
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("PIREP #123");
    expect(dialog?.textContent).toContain("Staff reviewed this report");
    expect(mocks.authFetch).toHaveBeenCalledWith("/api/pilots/42/pireps?pirepId=123");

    await act(async () => button("Close").click());
    expect(mocks.replace).toHaveBeenCalledWith("/crew/view-pireps", { scroll: false });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => root.render(<ViewPireps />));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(mocks.authFetch).toHaveBeenCalledTimes(2);
  });

  it("keeps comments working for a report outside the current list", async () => {
    await act(async () => root.render(<ViewPireps />));
    const input = document.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Thank you");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button("Post comment").click());

    expect(mocks.authFetch).toHaveBeenCalledWith("/api/pilots/42/pireps", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ pirepId: 123, content: "Thank you" }),
    }));
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Thank you");
  });

  it("shows a missing report error while retaining the normal report list", async () => {
    const normalFetch = mocks.authFetch.getMockImplementation()!;
    mocks.authFetch.mockImplementation((url: string) => url.includes("pirepId=")
      ? Promise.resolve(Response.json({ error: "PIREP not found" }, { status: 404 }))
      : normalFetch(url));
    await act(async () => root.render(<ViewPireps />));

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("PIREP not found");
    expect(container.textContent).toContain("CZ200");
  });
});
