import { NextResponse } from "next/server";
import { Op } from "sequelize";
import { models } from "@/lib/models";
import { requireCrewAuth } from "@/lib/server-auth";
import { getSafeAwards } from "@/lib/awards/columns";
import { MASTER_BADGES } from "@/lib/awards/catalog";
import {
  parseStoredNotification,
  type MarkNotificationsReadResponse,
  type PilotNotification,
  type PilotNotificationAward,
  type PilotNotificationsResponse,
  type StoredNotificationRef,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_MARK_READ_IDS = 100;

type NotificationRow = {
  id: number;
  icon: string;
  subject: string;
  content: string;
  datetime: Date | string | null;
  read_at: Date | string | null;
};

type AwardLookup = {
  byId: Map<number, PilotNotificationAward>;
  byName: Map<string, PilotNotificationAward>;
};

function errorResponse(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

async function authorizeOwnInbox(
  request: Request,
  params: Promise<{ id: string }>,
) {
  const auth = await requireCrewAuth(request);
  if (!auth.ok) return { ok: false as const, response: auth.response };

  const { id } = await params;
  const pilotId = Number(id);
  if (!Number.isInteger(pilotId) || pilotId <= 0) {
    return {
      ok: false as const,
      response: errorResponse("Invalid pilot id", 400),
    };
  }

  // A pilot's own inbox only: staff permissions do not open someone else's.
  if (String(auth.user.id) !== String(pilotId)) {
    return { ok: false as const, response: errorResponse("Forbidden", 403) };
  }

  return { ok: true as const, pilotId };
}

function unreadCountFor(pilotId: number) {
  return models.Notification.count({ where: { pilotid: pilotId, read_at: null } });
}

function toIso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function nameKey(name: string) {
  return name.trim().toLowerCase();
}

async function lookupAwards(refs: StoredNotificationRef[]): Promise<AwardLookup> {
  const ids = new Set<number>();
  const names = new Set<string>();
  for (const ref of refs) {
    if (ref.kind !== "award") continue;
    if (ref.awardId) ids.add(ref.awardId);
    if (ref.legacyName) names.add(ref.legacyName);
  }

  const lookup: AwardLookup = { byId: new Map(), byName: new Map() };
  if (ids.size === 0 && names.size === 0) return lookup;

  try {
    const conditions: Record<string, unknown>[] = [];
    if (ids.size > 0) conditions.push({ id: { [Op.in]: [...ids] } });
    if (names.size > 0) conditions.push({ name: { [Op.in]: [...names] } });

    const records = await getSafeAwards({
      where: { [Op.or]: conditions },
      attributes: ["id", "name", "name_zh", "imageurl"],
      order: [["id", "ASC"]],
    });
    for (const record of records) {
      const award: PilotNotificationAward = {
        id: Number(record.id),
        name: record.name,
        nameZh: record.name_zh || record.nameZh || null,
        imageurl: record.imageurl || null,
      };
      lookup.byId.set(Number(record.id), award);
      lookup.byName.set(nameKey(record.name), award);
    }
  } catch (error) {
    // The inbox still renders; affected items fall back to generic text.
    console.warn("[Notifications] Award lookup failed:", error);
  }

  // When a catalog badge has no awards row and inserting one fails,
  // evaluateAndGrantAwards grants it under the catalog id, so fall back to it.
  for (const badge of MASTER_BADGES) {
    const award: PilotNotificationAward = {
      id: badge.id,
      name: badge.name,
      nameZh: badge.nameZh,
      imageurl: badge.imageurl,
    };
    if (ids.has(badge.id) && !lookup.byId.has(badge.id)) {
      lookup.byId.set(badge.id, award);
    }
    if (!lookup.byName.has(nameKey(badge.name))) {
      lookup.byName.set(nameKey(badge.name), award);
    }
  }

  return lookup;
}

function resolveAward(
  ref: Extract<StoredNotificationRef, { kind: "award" }>,
  lookup: AwardLookup,
): PilotNotificationAward | null {
  if (ref.awardId) return lookup.byId.get(ref.awardId) ?? null;
  if (!ref.legacyName) return null;
  return (
    lookup.byName.get(nameKey(ref.legacyName)) ?? {
      id: null,
      name: ref.legacyName,
      nameZh: null,
      imageurl: null,
    }
  );
}

function toPilotNotification(
  row: NotificationRow,
  ref: StoredNotificationRef,
  lookup: AwardLookup,
): PilotNotification {
  const base = {
    id: Number(row.id),
    createdAt: toIso(row.datetime),
    readAt: toIso(row.read_at),
  };

  if (ref.kind === "award") {
    return { ...base, kind: "award", award: resolveAward(ref, lookup) };
  }

  return {
    ...base,
    kind: "message",
    icon: String(row.icon ?? ""),
    subject: String(row.subject ?? ""),
    content: String(row.content ?? ""),
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await authorizeOwnInbox(request, params);
    if (!access.ok) return access.response;
    const { pilotId } = access;

    const limitParam = Number(
      new URL(request.url).searchParams.get("limit") ?? DEFAULT_LIMIT,
    );
    const limit =
      Number.isInteger(limitParam) && limitParam > 0
        ? Math.min(limitParam, MAX_LIMIT)
        : DEFAULT_LIMIT;

    const [rows, unreadCount] = await Promise.all([
      models.Notification.findAll({
        where: { pilotid: pilotId },
        attributes: ["id", "icon", "subject", "content", "datetime", "read_at"],
        order: [
          ["datetime", "DESC"],
          ["id", "DESC"],
        ],
        limit,
        raw: true,
      }) as unknown as Promise<NotificationRow[]>,
      unreadCountFor(pilotId),
    ]);

    const refs = rows.map(parseStoredNotification);
    const lookup = await lookupAwards(refs);
    const body: PilotNotificationsResponse = {
      success: true,
      notifications: rows.map((row, index) =>
        toPilotNotification(row, refs[index], lookup),
      ),
      unreadCount,
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[Notifications] Error loading inbox:", error);
    return errorResponse("Failed to load notifications", 500);
  }
}

function parseMarkReadSelection(body: unknown): number[] | "all" | null {
  if (!body || typeof body !== "object") return null;
  const { ids, all } = body as { ids?: unknown; all?: unknown };
  if (all === true) return "all";

  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > MAX_MARK_READ_IDS ||
    !ids.every((id) => Number.isInteger(id) && id > 0)
  ) {
    return null;
  }

  return [...new Set(ids as number[])];
}

/** Marks notifications read: body `{ "ids": [1, 2] }` or `{ "all": true }`. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const access = await authorizeOwnInbox(request, params);
    if (!access.ok) return access.response;
    const { pilotId } = access;

    const selection = parseMarkReadSelection(
      await request.json().catch(() => null),
    );
    if (!selection) {
      return errorResponse(
        `Send { "ids": [notification ids] } (1-${MAX_MARK_READ_IDS}) or { "all": true }`,
        400,
      );
    }

    const [updated] = await models.Notification.update(
      { read_at: new Date() },
      {
        where:
          selection === "all"
            ? { pilotid: pilotId, read_at: null }
            : { pilotid: pilotId, read_at: null, id: { [Op.in]: selection } },
      },
    );

    const body: MarkNotificationsReadResponse = {
      success: true,
      updated,
      unreadCount: await unreadCountFor(pilotId),
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("[Notifications] Error marking notifications read:", error);
    return errorResponse("Failed to update notifications", 500);
  }
}
