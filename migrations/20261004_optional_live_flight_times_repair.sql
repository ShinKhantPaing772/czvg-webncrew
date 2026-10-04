-- Recovery ONLY for the partially applied 20261004 migration:
--   1. ADD queue_order / nullable planned times succeeded.
--   2. UPDATE failed with safe-update error 1175.
--   3. Final ALTER failed with reserved_queue_order check error 3819.
-- MySQL 8 InnoDB rolls back that failed final ALTER, so the old queue index
-- remains and the new indexes/checks have not been added.
-- Back up the database and pause scheduling writes. Run this whole file once
-- in the same selected database. Do not rerun the original ADD COLUMN step.
-- Do not run this recovery after a successful upgrade or new queue assignments.

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

-- Expected: reserved_flights_without_queue_order = 0.
SELECT COUNT(*) AS `reserved_flights_without_queue_order`
FROM `live_flights`
WHERE `status` IN ('approved', 'in_progress') AND `queue_order` IS NULL;

SHOW CREATE TABLE `live_flights`;
