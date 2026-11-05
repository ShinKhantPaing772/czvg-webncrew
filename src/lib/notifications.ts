/**
 * Pilot notifications (`notifications` table) and the inbox API's response
 * shape. No database imports, so client components can use the types.
 */

import { AWARD_GRANTED_SUBJECT } from "./notification-format.mjs";

export {
  AWARD_GRANTED_SUBJECT,
  AWARD_NOTIFICATION_ICON,
  awardGrantedContent,
} from "./notification-format.mjs";

// Format of rows written before AWARD_GRANTED_SUBJECT, by the evaluator and
// the /scripts backfills; those rows stay in the table:
// subject "获得新勋章", content "祝贺你解锁了成就勋章【<award name>】！".
const LEGACY_AWARD_SUBJECT = "获得新勋章";
const LEGACY_AWARD_CONTENT = /^祝贺你解锁了成就勋章【(.+)】！$/;

export type StoredNotificationRef =
  | { kind: "award"; awardId: number | null; legacyName: string | null }
  | { kind: "message" };

export function parseStoredNotification(row: {
  subject?: string | null;
  content?: string | null;
}): StoredNotificationRef {
  const content = String(row.content ?? "");

  if (row.subject === AWARD_GRANTED_SUBJECT) {
    let awardId: number | null = null;
    try {
      const parsed = Number(JSON.parse(content)?.awardId);
      if (Number.isInteger(parsed) && parsed > 0) awardId = parsed;
    } catch {
      // Unreadable payload: still an award notification, just without a name.
    }
    return { kind: "award", awardId, legacyName: null };
  }

  if (row.subject === LEGACY_AWARD_SUBJECT) {
    // No name when the text was cut short (non-strict MySQL truncates).
    const legacy = LEGACY_AWARD_CONTENT.exec(content);
    return {
      kind: "award",
      awardId: null,
      legacyName: legacy ? legacy[1].trim() : null,
    };
  }

  return { kind: "message" };
}

export type PilotNotificationAward = {
  id: number | null;
  name: string;
  nameZh: string | null;
  imageurl: string | null;
};

type PilotNotificationBase = {
  id: number;
  createdAt: string | null;
  readAt: string | null;
};

export type PilotNotification =
  | (PilotNotificationBase & {
      kind: "award";
      /** Null when the award no longer exists. */
      award: PilotNotificationAward | null;
    })
  | (PilotNotificationBase & {
      kind: "message";
      icon: string;
      subject: string;
      content: string;
    });

export type PilotNotificationsResponse = {
  success: true;
  notifications: PilotNotification[];
  unreadCount: number;
};

export type MarkNotificationsReadResponse = {
  success: true;
  updated: number;
  unreadCount: number;
};
