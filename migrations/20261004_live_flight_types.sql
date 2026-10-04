-- Live scheduling flight types. Apply once after the live scheduling migrations.
-- Pause scheduling writes while applying this MySQL 8 migration.
-- Existing flights become Commercial. This single atomic ALTER requires no
-- backfill UPDATE and works with Workbench's SQL_SAFE_UPDATES enabled.
ALTER TABLE `live_flights`
  ADD COLUMN `flight_type` VARCHAR(32) NOT NULL DEFAULT 'commercial' AFTER `callsign`,
  ADD CONSTRAINT `live_flights_flight_type` CHECK (CAST(`flight_type` AS BINARY) IN ('commercial', 'freight', 'ferry', 'charter', 'training', 'test_flight', 'medical_emergency', 'military', 'vip_executive', 'humanitarian_relief', 'general_aviation', 'airshow', 'other'));
