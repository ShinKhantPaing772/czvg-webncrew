-- Apply once after 20261002_live_scheduling.sql, before deploying this update.
-- Pause scheduling writes while applying this MySQL 8 migration.
-- Existing approved/history rows retain their chronological aircraft order.
-- Pending requests do not reserve a queue position; approval appends them.
ALTER TABLE `live_flights`
  ADD COLUMN `queue_order` INT NULL AFTER `arrival`,
  MODIFY COLUMN `scheduled_departure` DATETIME(3) NULL,
  MODIFY COLUMN `scheduled_arrival` DATETIME(3) NULL;

-- Workbench commonly enables safe updates. This intentional whole-table
-- backfill temporarily disables that protection on this connection only.
SET @live_schedule_previous_safe_updates = @@SESSION.sql_safe_updates;
SET SESSION sql_safe_updates = 0;

UPDATE `live_flights` AS flight
INNER JOIN (
  SELECT `id`, ROW_NUMBER() OVER (
    PARTITION BY `live_aircraft_id` ORDER BY `scheduled_departure`, `id`
  ) AS `assigned_order`
  FROM `live_flights`
  WHERE `status` <> 'pending'
) AS existing_queue ON existing_queue.`id` = flight.`id`
SET flight.`queue_order` = existing_queue.`assigned_order`;

SET SESSION sql_safe_updates = @live_schedule_previous_safe_updates;

ALTER TABLE `live_flights`
  DROP INDEX `live_flights_queue`,
  ADD UNIQUE KEY `live_flights_queue_order` (`live_aircraft_id`, `queue_order`),
  ADD KEY `live_flights_queue` (`live_aircraft_id`, `status`, `queue_order`),
  ADD CONSTRAINT `live_flights_time_pair` CHECK (
    (`scheduled_departure` IS NULL AND `scheduled_arrival` IS NULL)
    OR (`scheduled_departure` IS NOT NULL AND `scheduled_arrival` IS NOT NULL
      AND `scheduled_arrival` > `scheduled_departure`)
  ),
  ADD CONSTRAINT `live_flights_positive_queue_order` CHECK (`queue_order` IS NULL OR `queue_order` > 0),
  ADD CONSTRAINT `live_flights_reserved_queue_order` CHECK (`status` NOT IN ('approved', 'in_progress') OR `queue_order` IS NOT NULL);
