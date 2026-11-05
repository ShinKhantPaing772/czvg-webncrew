import { NextResponse } from "next/server";
import { Op } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findAll: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  getSafeAwards: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({ requireCrewAuth: mocks.auth }));
vi.mock("@/lib/models", () => ({
  models: {
    Notification: {
      findAll: mocks.findAll,
      count: mocks.count,
      update: mocks.update,
    },
  },
}));
vi.mock("@/lib/awards/columns", () => ({ getSafeAwards: mocks.getSafeAwards }));

import { GET, PATCH } from "./route";

const signedIn = (id = 42, permissions: string[] = []) => ({
  ok: true,
  token: "token",
  user: { id, email: "pilot@example.com", permissions },
});

const context = (id = "42") => ({ params: Promise.resolve({ id }) });

function get(query = "", id = "42") {
  return GET(
    new Request(`http://localhost/api/pilots/${id}/notifications${query}`, {
      headers: { Authorization: "Bearer token" },
    }),
    context(id),
  );
}

function patch(body: unknown, id = "42") {
  return PATCH(
    new Request(`http://localhost/api/pilots/${id}/notifications`, {
      method: "PATCH",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    context(id),
  );
}

function row(overrides: Record<string, unknown>) {
  return {
    id: 1,
    icon: "award",
    subject: "award_granted",
    content: '{"awardId":7}',
    datetime: new Date("2026-11-01T08:00:00Z"),
    read_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue(signedIn());
  mocks.findAll.mockReset().mockResolvedValue([]);
  mocks.count.mockReset().mockResolvedValue(0);
  mocks.update.mockReset().mockResolvedValue([0]);
  mocks.getSafeAwards.mockReset().mockResolvedValue([]);
});

describe("access", () => {
  it("passes through the auth failure response", async () => {
    mocks.auth.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Authentication token required" }, { status: 401 }),
    });

    expect((await get()).status).toBe(401);
    expect((await patch({ all: true })).status).toBe(401);
    expect(mocks.findAll).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects a malformed pilot id", async () => {
    expect((await get("", "abc")).status).toBe(400);
    expect((await patch({ all: true }, "0")).status).toBe(400);
  });

  it("only opens the signed-in pilot's own inbox, even for staff", async () => {
    mocks.auth.mockResolvedValue(signedIn(7, ["admin", "users", "pireps"]));

    const read = await get();
    const write = await patch({ all: true });

    expect(read.status).toBe(403);
    expect(write.status).toBe(403);
    expect(mocks.findAll).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("GET /api/pilots/[id]/notifications", () => {
  it("returns the latest notifications for the pilot with the unread count", async () => {
    mocks.findAll.mockResolvedValue([
      row({
        id: 9,
        icon: "info",
        subject: "Welcome",
        content: "Welcome aboard",
        read_at: new Date("2026-11-02T09:30:00Z"),
      }),
    ]);
    mocks.count.mockResolvedValue(3);

    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      unreadCount: 3,
      notifications: [
        {
          id: 9,
          kind: "message",
          icon: "info",
          subject: "Welcome",
          content: "Welcome aboard",
          createdAt: "2026-11-01T08:00:00.000Z",
          readAt: "2026-11-02T09:30:00.000Z",
        },
      ],
    });
    expect(mocks.findAll).toHaveBeenCalledWith({
      where: { pilotid: 42 },
      attributes: ["id", "icon", "subject", "content", "datetime", "read_at"],
      order: [
        ["datetime", "DESC"],
        ["id", "DESC"],
      ],
      limit: 20,
      raw: true,
    });
    expect(mocks.count).toHaveBeenCalledWith({
      where: { pilotid: 42, read_at: null },
    });
    expect(mocks.getSafeAwards).not.toHaveBeenCalled();
  });

  it.each([
    ["?limit=5", 5],
    ["?limit=500", 50],
    ["?limit=0", 20],
    ["?limit=abc", 20],
  ])("bounds the page size for %s", async (query, limit) => {
    await get(query);
    expect(mocks.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit }));
  });

  it("resolves award notifications to bilingual award names", async () => {
    mocks.findAll.mockResolvedValue([
      row({ id: 5, content: '{"awardId":7}' }),
      // Legacy rows hold Chinese text with the English award name inside.
      row({
        id: 4,
        subject: "获得新勋章",
        content: "祝贺你解锁了成就勋章【First Light】！",
      }),
      row({
        id: 3,
        subject: "获得新勋章",
        content: "祝贺你解锁了成就勋章【Retired Award】！",
      }),
      // Catalog badge granted under its catalog id (no awards row).
      row({ id: 2, content: '{"awardId":102}' }),
      // Award deleted since it was granted.
      row({ id: 1, content: '{"awardId":999}' }),
      // Legacy text cut at 60 characters, so no award name survives.
      row({
        id: 0,
        subject: "获得新勋章",
        content: "祝贺你解锁了成就勋章【Extraordinary Transcontinental Long-Haul Excellen",
      }),
    ]);
    mocks.getSafeAwards.mockResolvedValue([
      {
        id: 7,
        name: "Ocean Crossing",
        name_zh: "跨洋",
        nameZh: "跨洋",
        imageurl: "/badges/ocean.svg",
      },
    ]);

    const response = await get();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.getSafeAwards).toHaveBeenCalledWith({
      where: {
        [Op.or]: [
          { id: { [Op.in]: [7, 102, 999] } },
          { name: { [Op.in]: ["First Light", "Retired Award"] } },
        ],
      },
      attributes: ["id", "name", "name_zh", "imageurl"],
      order: [["id", "ASC"]],
    });
    expect(
      body.notifications.map((item: { id: number; kind: string; award: unknown }) => [
        item.id,
        item.kind,
        item.award,
      ]),
    ).toEqual([
      [5, "award", { id: 7, name: "Ocean Crossing", nameZh: "跨洋", imageurl: "/badges/ocean.svg" }],
      [4, "award", expect.objectContaining({ id: 101, name: "First Light", nameZh: "初光" })],
      [3, "award", { id: null, name: "Retired Award", nameZh: null, imageurl: null }],
      [2, "award", expect.objectContaining({ id: 102, name: "Dawn Flight", nameZh: "破晓" })],
      [1, "award", null],
      [0, "award", null],
    ]);
    // Award rows never leak the storage keys or legacy Chinese text.
    expect(JSON.stringify(body)).not.toContain("award_granted");
    expect(JSON.stringify(body)).not.toContain("祝贺你");
  });

  it("still returns the inbox when the award lookup fails", async () => {
    mocks.findAll.mockResolvedValue([row({ id: 5, content: '{"awardId":7}' })]);
    mocks.count.mockResolvedValue(1);
    mocks.getSafeAwards.mockRejectedValue(new Error("awards table locked"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      unreadCount: 1,
      notifications: [{ id: 5, kind: "award", award: null, readAt: null }],
    });
    warn.mockRestore();
  });

  it("returns 500 when the notifications query fails", async () => {
    mocks.findAll.mockRejectedValue(new Error("Unknown column 'read_at'"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await get();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: "Failed to load notifications",
    });
    error.mockRestore();
  });
});

describe("PATCH /api/pilots/[id]/notifications", () => {
  it("marks the given unread notifications of this pilot read", async () => {
    mocks.update.mockResolvedValue([2]);
    mocks.count.mockResolvedValue(1);

    const response = await patch({ ids: [3, 5, 3] });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      updated: 2,
      unreadCount: 1,
    });
    expect(mocks.update).toHaveBeenCalledWith(
      { read_at: expect.any(Date) },
      { where: { pilotid: 42, read_at: null, id: { [Op.in]: [3, 5] } } },
    );
    expect(mocks.count).toHaveBeenCalledWith({
      where: { pilotid: 42, read_at: null },
    });
  });

  it("marks every unread notification read with { all: true }", async () => {
    mocks.update.mockResolvedValue([4]);

    const response = await patch({ all: true });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ updated: 4, unreadCount: 0 });
    expect(mocks.update).toHaveBeenCalledWith(
      { read_at: expect.any(Date) },
      { where: { pilotid: 42, read_at: null } },
    );
  });

  it.each([
    ["no selection", {}],
    ["empty ids", { ids: [] }],
    ["string ids", { ids: ["3"] }],
    ["negative ids", { ids: [-1] }],
    ["fractional ids", { ids: [1.5] }],
    ["too many ids", { ids: Array.from({ length: 101 }, (_, index) => index + 1) }],
    ["all not true", { all: "yes" }],
    ["invalid JSON", "{"],
  ])("rejects %s", async (_label, body) => {
    const response = await patch(body);

    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns 500 when the update fails", async () => {
    mocks.update.mockRejectedValue(new Error("Unknown column 'read_at'"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await patch({ all: true });

    expect(response.status).toBe(500);
    error.mockRestore();
  });
});
