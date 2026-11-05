-- Pilot notifications inbox: remember when a pilot read each notification.
-- NULL means unread. The index serves the per-pilot unread count that the
-- crew header polls.
-- Apply before deploying the inbox: GET /api/pilots/:id/notifications selects
-- `read_at`. Award grants keep writing notifications either way.
-- Run once. A second run stops at "Duplicate column name" without changes.
ALTER TABLE `notifications`
  ADD COLUMN `read_at` DATETIME NULL DEFAULT NULL,
  ADD KEY `notifications_pilot_unread` (`pilotid`, `read_at`);

SHOW CREATE TABLE `notifications`;
