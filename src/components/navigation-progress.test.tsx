// @vitest-environment jsdom

import React, { act, useInsertionEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navState = vi.hoisted(() => ({
  pathname: "/crew/home",
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navState.pathname,
  useSearchParams: () => navState.searchParams,
}));

vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({}),
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (en: string, zh: string) => zh }),
}));

import { NavigationProgress } from "./navigation-progress";

let container: HTMLDivElement;
let root: Root | null;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  navState.pathname = "/crew/home";
  navState.searchParams = new URLSearchParams();
  window.history.replaceState(null, "", "/crew/home");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.useFakeTimers();
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
    root = null;
  });
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function HistoryCommit({
  enabled,
  method,
}: {
  enabled: boolean;
  method: "pushState" | "replaceState";
}) {
  useInsertionEffect(() => {
    if (enabled) window.history[method]({ __NA: true }, "", "/crew/view-pireps");
  }, [enabled, method]);
  return null;
}

describe("NavigationProgress", () => {
  it("renders the spinner and progress bar container without crashing", async () => {
    await act(async () => {
      root!.render(<NavigationProgress />);
    });

    const statusEl = container.querySelector('[role="status"]');
    expect(statusEl).not.toBeNull();
    expect(statusEl?.textContent).toContain("加载中...");
  });

  it("activates spinner on internal link click and trickles progress", async () => {
    await act(async () => {
      root!.render(
        <div>
          <NavigationProgress />
          <a href="/crew/find-routes" id="test-link" onClick={(e) => e.preventDefault()}>
            Find Routes
          </a>
        </div>,
      );
    });

    const link = container.querySelector<HTMLAnchorElement>("#test-link")!;
    expect(link).not.toBeNull();

    await act(async () => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });

    const statusEl = container.querySelector('[role="status"]');
    expect(statusEl?.classList.contains("opacity-100")).toBe(true);

    // Fast-forward trickle timers
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    const progressBar = container.querySelector<HTMLDivElement>('[aria-hidden="true"] > div');
    expect(progressBar).not.toBeNull();
    const widthVal = parseFloat(progressBar?.style.width || "0");
    expect(widthVal).toBeGreaterThan(18);
  });

  it("hides spinner smoothly when route updates", async () => {
    await act(async () => {
      root!.render(
        <div>
          <NavigationProgress />
          <a href="/crew/view-pireps" id="test-link" onClick={(e) => e.preventDefault()}>
            PIREPs
          </a>
        </div>,
      );
    });

    const link = container.querySelector<HTMLAnchorElement>("#test-link")!;
    await act(async () => {
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });

    // Simulate route navigation completion
    navState.pathname = "/crew/view-pireps";
    await act(async () => {
      root!.render(
        <div>
          <NavigationProgress />
        </div>,
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    const statusEl = container.querySelector('[role="status"]');
    expect(statusEl?.classList.contains("opacity-0")).toBe(true);
  });

  it.each(["pushState", "replaceState"] as const)(
    "allows Next's %s during an insertion effect without scheduling React updates",
    async (method) => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      await act(async () => {
        root!.render(<><NavigationProgress /><HistoryCommit enabled={false} method={method} /></>);
      });

      navState.pathname = "/crew/view-pireps";
      await act(async () => {
        root!.render(<><NavigationProgress /><HistoryCommit enabled method={method} /></>);
      });

      expect(errors.mock.calls.flat().join(" ")).not.toContain(
        "useInsertionEffect must not schedule updates",
      );
      expect(window.location.pathname).toBe("/crew/view-pireps");
      await act(async () => { vi.advanceTimersByTime(400); });
      expect(container.querySelector('[role="status"]')?.getAttribute("aria-hidden")).toBe("true");
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each(["pushState", "replaceState"] as const)(
    "still starts progress for programmatic %s outside a completed route update",
    async (method) => {
      await act(async () => { root!.render(<NavigationProgress />); });
      await act(async () => {
        window.history[method]({ source: "test" }, "", "/crew/find-routes");
      });
      await act(async () => { vi.advanceTimersByTime(0); });

      expect(window.location.pathname).toBe("/crew/find-routes");
      expect(window.history.state).toEqual({ source: "test" });
      expect(container.querySelector('[role="status"]')?.getAttribute("aria-hidden")).toBe("false");

      navState.pathname = "/crew/find-routes";
      await act(async () => { root!.render(<NavigationProgress />); });
      await act(async () => { vi.advanceTimersByTime(400); });
      expect(container.querySelector('[role="status"]')?.getAttribute("aria-hidden")).toBe("true");
    },
  );

  it("cancels a deferred history start on unmount", async () => {
    await act(async () => { root!.render(<NavigationProgress />); });
    await act(async () => {
      window.history.pushState(null, "", "/crew/find-routes");
      root!.unmount();
      root = null;
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
