// Storage format of pilot notifications (`notifications` table). Plain ESM so
// the app (via src/lib/notifications.ts) and the Node scripts in /scripts
// write the same rows.

export const AWARD_NOTIFICATION_ICON = "award";

/**
 * `subject` of a badge-grant row. The row stores this key plus the award id
 * instead of display text, so the inbox can show the award name in the
 * reader's language and long names cannot overflow `content` (VARCHAR(60)).
 */
export const AWARD_GRANTED_SUBJECT = "award_granted";

/**
 * @param {number} awardId
 * @returns {string}
 */
export function awardGrantedContent(awardId) {
  return JSON.stringify({ awardId });
}
