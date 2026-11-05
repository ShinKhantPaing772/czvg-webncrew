// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PilotNotification } from "@/lib/notifications";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/utils/api", () => ({ authFetch: mocks.fetch }));

import { usePilotNotifications } from "@/hooks/use-pilot-notifications";
import { I18nProvider, LOCALE_STORAGE_KEY, useI18n } from "@/lib/i18n";
import {
  NotificationBell,
  formatNotificationTime,
} from "./notification-bell";

let root: Root;
let container: HTMLDivElement;
let serverNotifications: PilotNotification[];
// Each test uses its own pilot id: the hook keeps the last inbox per pilot.
let nextPilotId = 100;

function inboxFixture(): PilotNotification[] {
  return [
    {
      id: 5,
      kind: "award",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      readAt: null,
      award: { id: 7, name: "Ocean Crossing", nameZh: "跨洋", imageurl: "/badges/ocean.svg" },
    },
    {
      id: 4,
      kind: "award",
      createdAt: "2026-10-01T08:00:00.000Z",
      readAt: null,
      award: null,
    },
    {
      id: 3,
      kind: "message",
      icon: "info",
      subject: "Welcome",
      content: "Welcome aboard",
      createdAt: "2026-09-01T08:00:00.000Z",
      readAt: "2026-09-02T08:00:00.000Z",
    },
  ];
}

const unread = () => serverNotifications.filter((item) => !item.readAt).length;

function Harness({ pilotId }: { pilotId: string }) {
  const inbox = usePilotNotifications(pilotId);
  return <NotificationBell inbox={inbox} />;
}

async function render({ locale = "en" } = {}) {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  const pilotId = String(nextPilotId++);
  await act(async () =>
    root.render(
      <I18nProvider>
        <Harness pilotId={pilotId} />
      </I18nProvider>,
    ),
  );
  return pilotId;
}

const bell = () =>
  container.querySelector<HTMLButtonElement>('button[aria-label^="Notifications"], button[aria-label^="通知"]')!;
const page = () => document.body.textContent ?? "";
const button = (text: string) =>
  [...document.body.querySelectorAll("button")].find((item) =>
    item.textContent?.includes(text),
  )!;

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  serverNotifications = inboxFixture();
  mocks.fetch.mockReset().mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      const selection = JSON.parse(String(init.body)) as { ids?: number[]; all?: boolean };
      serverNotifications = serverNotifications.map((item) =>
        !item.readAt && (selection.all || selection.ids?.includes(item.id))
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      );
      return Response.json({ success: true, updated: 1, unreadCount: unread() });
    }
    return Response.json({
      success: true,
      notifications: serverNotifications,
      unreadCount: unread(),
    });
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("NotificationBell", () => {
  it("shows the unread count and the inbox in English", async () => {
    const pilotId = await render();

    expect(mocks.fetch).toHaveBeenCalledWith(
      `/api/pilots/${pilotId}/notifications?limit=20`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(bell().getAttribute("aria-label")).toBe("Notifications, 2 unread");
    expect(bell().textContent).toBe("2");

    await click(bell());

    expect(page()).toContain("New badge unlocked");
    expect(page()).toContain("You unlocked the “Ocean Crossing” badge.");
    expect(page()).toContain("You unlocked a new badge.");
    expect(page()).toContain("Welcome aboard");
    expect(page()).toContain("2 hours ago");
    expect(page()).toContain("Mark all read");
  });

  it("shows award names in Chinese", async () => {
    await render({ locale: "zh" });

    expect(bell().getAttribute("aria-label")).toBe("通知，2 条未读");
    await click(bell());

    expect(page()).toContain("获得新勋章");
    expect(page()).toContain("祝贺你解锁了成就勋章【跨洋】！");
    expect(page()).toContain("你解锁了一枚新勋章。");
    expect(page()).toContain("全部标为已读");
  });

  it("marks one notification read when it is clicked", async () => {
    const pilotId = await render();
    await click(bell());

    await click(button("Ocean Crossing"));

    expect(mocks.fetch).toHaveBeenCalledWith(`/api/pilots/${pilotId}/notifications`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [5] }),
    });
    expect(bell().textContent).toBe("1");
    // Read rows are no longer buttons.
    expect(button("Ocean Crossing")).toBeUndefined();
  });

  it("marks everything read", async () => {
    await render();
    await click(bell());

    await click(button("Mark all read"));

    const patchCall = mocks.fetch.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(patchCall![1].body)).toEqual({ all: true });
    expect(bell().getAttribute("aria-label")).toBe("Notifications");
    expect(bell().textContent).toBe("");
    expect(page()).not.toContain("Mark all read");
  });

  it("offers a retry when the inbox cannot load", async () => {
    mocks.fetch.mockImplementationOnce(async () => Response.json({}, { status: 500 }));
    mocks.fetch.mockImplementationOnce(async () => Response.json({}, { status: 500 }));
    await render();
    await click(bell());

    expect(page()).toContain("Couldn't load notifications.");

    await click(button("Try again"));

    expect(page()).toContain("You unlocked the “Ocean Crossing” badge.");
    expect(bell().textContent).toBe("2");
  });

  it("shows an empty state", async () => {
    serverNotifications = [];
    await render();
    await click(bell());

    expect(page()).toContain("No notifications yet");
    expect(bell().textContent).toBe("");
  });
});

describe("formatNotificationTime", () => {
  const now = Date.parse("2026-11-04T12:00:00Z");
  const translate = (en: string) => en;

  it.each([
    ["2026-11-04T11:59:30Z", "Just now"],
    ["2026-11-04T11:15:00Z", "45 minutes ago"],
    ["2026-11-04T09:00:00Z", "3 hours ago"],
    ["2026-11-03T10:00:00Z", "yesterday"],
    // Noon UTC stays Oct 1 in local time from UTC-12 to UTC+11.
    ["2026-10-01T12:00:00Z", "Oct 1, 2026"],
  ])("formats %s as %s", (iso, expected) => {
    expect(formatNotificationTime(iso, "en", translate, now)).toBe(expected);
  });

  it("uses Chinese relative time", () => {
    const chinese = (_en: string, zh: string) => zh;
    expect(formatNotificationTime("2026-11-04T09:00:00Z", "zh", chinese, now)).toBe("3小时前");
    expect(formatNotificationTime("2026-11-04T11:59:30Z", "zh", chinese, now)).toBe("刚刚");
  });
});
