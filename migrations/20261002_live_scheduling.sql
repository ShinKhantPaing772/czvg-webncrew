-- Run manually before deploying live scheduling. Does not grant pilot access.
-- All identities reference the existing signed INT primary keys.
CREATE TABLE IF NOT EXISTS `live_aircraft` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `registration` VARCHAR(24) NOT NULL,
  `aircraft_id` INT NOT NULL,
  `current_airport` CHAR(4) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `location_updated_by` INT NULL,
  `location_updated_at` DATETIME(3) NULL,
  `if_aircraft_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `live_aircraft_registration` (`registration`),
  UNIQUE KEY `live_aircraft_if_binding` (`if_aircraft_id`),
  FOREIGN KEY (`aircraft_id`) REFERENCES `aircraft` (`id`),
  FOREIGN KEY (`location_updated_by`) REFERENCES `pilots` (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `live_flights` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `public_id` CHAR(36) NOT NULL,
  `live_aircraft_id` INT NOT NULL,
  `captain_id` INT NOT NULL,
  `callsign` VARCHAR(32) NULL,
  `departure` CHAR(4) NOT NULL,
  `arrival` CHAR(4) NOT NULL,
  `scheduled_departure` DATETIME(3) NOT NULL,
  `scheduled_arrival` DATETIME(3) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'pending',
  `notes` TEXT NULL,
  `reviewed_by` INT NULL,
  `reviewed_at` DATETIME(3) NULL,
  `review_reason` VARCHAR(500) NULL,
  `actual_departure_at` DATETIME(3) NULL,
  `actual_arrival_at` DATETIME(3) NULL,
  `actual_arrival` CHAR(4) NULL,
  `revision` INT NOT NULL DEFAULT 1,
  `published_revision` INT NOT NULL DEFAULT 0,
  `publishing_state` VARCHAR(24) NOT NULL DEFAULT 'local',
  `if_schedule_id` CHAR(36) NULL,
  `error` VARCHAR(500) NULL,
  `last_published_payload` JSON NULL COMMENT 'Application-authored outgoing payload only; never an IF response',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `live_flights_public_id` (`public_id`),
  KEY `live_flights_queue` (`live_aircraft_id`, `status`, `scheduled_departure`),
  KEY `live_flights_captain` (`captain_id`, `status`, `scheduled_departure`),
  KEY `live_flights_review` (`status`, `created_at`),
  FOREIGN KEY (`live_aircraft_id`) REFERENCES `live_aircraft` (`id`),
  FOREIGN KEY (`captain_id`) REFERENCES `pilots` (`id`),
  FOREIGN KEY (`reviewed_by`) REFERENCES `pilots` (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `live_flight_members` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `flight_id` INT NOT NULL,
  `pilot_id` INT NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `reviewed_by` INT NULL,
  `reviewed_at` DATETIME(3) NULL,
  `review_reason` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `live_flight_members_pilot` (`flight_id`, `pilot_id`),
  KEY `live_flight_members_assignments` (`pilot_id`, `status`),
  FOREIGN KEY (`flight_id`) REFERENCES `live_flights` (`id`),
  FOREIGN KEY (`pilot_id`) REFERENCES `pilots` (`id`),
  FOREIGN KEY (`reviewed_by`) REFERENCES `pilots` (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `live_schedule_events` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `live_aircraft_id` INT NOT NULL,
  `flight_id` INT NULL,
  `actor_id` INT NULL,
  `action` VARCHAR(40) NOT NULL,
  `details` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY `live_schedule_events_flight` (`flight_id`, `created_at`),
  FOREIGN KEY (`live_aircraft_id`) REFERENCES `live_aircraft` (`id`),
  FOREIGN KEY (`flight_id`) REFERENCES `live_flights` (`id`),
  FOREIGN KEY (`actor_id`) REFERENCES `pilots` (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `if_live_connections` (
  `id` INT NOT NULL PRIMARY KEY,
  `connected_by` INT NOT NULL,
  `organization_id` CHAR(36) NULL,
  `access_token_encrypted` TEXT NULL,
  `refresh_token_encrypted` TEXT NULL,
  `expires_at` DATETIME(3) NULL,
  `state` VARCHAR(24) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (`connected_by`) REFERENCES `pilots` (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `if_live_outbox` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `flight_id` INT NOT NULL,
  `revision` INT NOT NULL,
  `state` VARCHAR(24) NOT NULL DEFAULT 'queued',
  `action` VARCHAR(16) NOT NULL DEFAULT 'sync',
  `attempts` INT NOT NULL DEFAULT 0,
  `next_attempt_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lease_until` DATETIME(3) NULL,
  `error` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `if_live_outbox_revision` (`flight_id`, `revision`),
  KEY `if_live_outbox_ready` (`state`, `next_attempt_at`, `lease_until`),
  FOREIGN KEY (`flight_id`) REFERENCES `live_flights` (`id`)
) ENGINE=InnoDB;

-- A short transaction mutex makes queue-wide validation coherent across tails.
-- Pilot and aircraft rows are also locked to serialize award and fleet changes.
-- Some existing installations omitted this legacy table from their schema.
CREATE TABLE IF NOT EXISTS `options` (
  `name` VARCHAR(120) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL
) ENGINE=InnoDB;
INSERT IGNORE INTO `options` (`name`, `value`) VALUES ('live_scheduling_mutex', '1');
