CREATE TABLE `aircraft` (
  `id` int PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `name` text NOT NULL,
  `ifaircraftid` text DEFAULT null,
  `liveryname` text DEFAULT null,
  `ifliveryid` text DEFAULT null,
  `notes` varchar(12) DEFAULT null,
  `rankreq` int DEFAULT null,
  `awardreq` int DEFAULT null,
  `status` int NOT NULL DEFAULT 0
);

CREATE TABLE `awards` (
  `id` int PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `name` text NOT NULL,
  `description` text NOT NULL,
  `imageurl` text NOT NULL,
  `featured` tinyint DEFAULT null,
  UNIQUE KEY `awards_one_featured` (`featured`)
);

CREATE TABLE `awards_granted` (
  `id` int PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `awardid` int NOT NULL,
  `pilotid` int NOT NULL,
`dateawarded` date NOT NULL,
UNIQUE KEY `awards_granted_pilot_award` (`pilotid`, `awardid`)
);

CREATE TABLE `multipliers` (
  `id` int PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `code` int NOT NULL,
  `multiplier` double NOT NULL,
  `name` varchar(120) NOT NULL,
  `minrankid` int DEFAULT null
);

CREATE TABLE `notifications` (
  `id` int PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `pilotid` int NOT NULL,
  `icon` varchar(20) NOT NULL,
  `subject` varchar(20) NOT NULL,
  `content` varchar(60) NOT NULL,
  `datetime` datetime NOT NULL DEFAULT (current_timestamp())
);

CREATE TABLE `options` (
  `name` varchar(120) PRIMARY KEY NOT NULL,
  `value` text NOT NULL
) ENGINE=InnoDB;

CREATE TABLE `permissions` (
  `id` int PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `userid` int NOT NULL
);

CREATE TABLE `pilots` (
  `id` int PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `callsign` varchar(120) NOT NULL,
  `name` text NOT NULL,
  `ifc` text NOT NULL,
  `ifuserid` varchar(36) DEFAULT null,
  `email` text NOT NULL,
  `password` text NOT NULL,
  `transhours` int NOT NULL DEFAULT 0,
  `transflights` int NOT NULL DEFAULT 0,
  `violand` double DEFAULT null,
  `grade` int DEFAULT null,
  `notes` varchar(1200) NOT NULL DEFAULT '',
  `status` int NOT NULL DEFAULT 0,
  `joined` datetime NOT NULL DEFAULT (current_timestamp())
);

CREATE TABLE `pireps` (
  `id` int PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `flightnum` text DEFAULT null,
  `departure` varchar(4) NOT NULL,
  `arrival` varchar(4) NOT NULL,
  `flighttime` int NOT NULL,
  `pilotid` int NOT NULL,
  `date` date NOT NULL,
  `aircraftid` int NOT NULL,
  `fuelused` int NOT NULL,
  `multi` text NOT NULL,
  `status` int DEFAULT 0
);

CREATE TABLE `pireps_comments` (
  `id` int PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `pirepid` int NOT NULL,
  `userid` int NOT NULL,
  `content` text NOT NULL,
  `dateposted` datetime NOT NULL DEFAULT (current_timestamp())
);

CREATE TABLE `ranks` (
  `id` int PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `timereq` int NOT NULL,
  `imageurl` text DEFAULT null,
  `barcount` tinyint unsigned NOT NULL DEFAULT 1,
  `bartone` varchar(10) NOT NULL DEFAULT 'gold',
  `starcount` tinyint unsigned NOT NULL DEFAULT 0
);

CREATE TABLE `routes` (
  `id` int PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `fltnum` text DEFAULT null,
  `dep` varchar(4) NOT NULL,
  `arr` varchar(4) NOT NULL,
  `duration` int NOT NULL,
  `notes` text DEFAULT null
);

CREATE TABLE `route_aircraft` (
  `id` int PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `routeid` int NOT NULL,
  `aircraftid` int NOT NULL
);

ALTER TABLE `pireps` ADD FOREIGN KEY (`pilotid`) REFERENCES `pilots` (`id`);

ALTER TABLE `notifications` ADD FOREIGN KEY (`pilotid`) REFERENCES `pilots` (`id`);

ALTER TABLE `permissions` ADD FOREIGN KEY (`userid`) REFERENCES `pilots` (`id`);

ALTER TABLE `pireps_comments` ADD FOREIGN KEY (`userid`) REFERENCES `pilots` (`id`);

ALTER TABLE `pireps` ADD FOREIGN KEY (`aircraftid`) REFERENCES `aircraft` (`id`);

ALTER TABLE `awards_granted` ADD FOREIGN KEY (`awardid`) REFERENCES `awards` (`id`);

ALTER TABLE `awards_granted` ADD FOREIGN KEY (`pilotid`) REFERENCES `pilots` (`id`);

ALTER TABLE `aircraft` ADD FOREIGN KEY (`rankreq`) REFERENCES `ranks` (`id`);

ALTER TABLE `route_aircraft` ADD FOREIGN KEY (`aircraftid`) REFERENCES `aircraft` (`id`);

ALTER TABLE `route_aircraft` ADD FOREIGN KEY (`routeid`) REFERENCES `routes` (`id`);

ALTER TABLE `pireps_comments` ADD FOREIGN KEY (`pirepid`) REFERENCES `pireps` (`id`);

ALTER TABLE `aircraft` ADD FOREIGN KEY (`awardreq`) REFERENCES `awards` (`id`);

-- Live aircraft scheduling
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
  `flight_type` VARCHAR(32) NOT NULL DEFAULT 'commercial',
  `departure` CHAR(4) NOT NULL,
  `arrival` CHAR(4) NOT NULL,
  `queue_order` INT NULL,
  `scheduled_departure` DATETIME(3) NULL,
  `scheduled_arrival` DATETIME(3) NULL,
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
  UNIQUE KEY `live_flights_queue_order` (`live_aircraft_id`, `queue_order`),
  KEY `live_flights_queue` (`live_aircraft_id`, `status`, `queue_order`),
  KEY `live_flights_captain` (`captain_id`, `status`, `scheduled_departure`),
  KEY `live_flights_review` (`status`, `created_at`),
  CONSTRAINT `live_flights_flight_type` CHECK (CAST(`flight_type` AS BINARY) IN ('commercial', 'freight', 'ferry', 'charter', 'training', 'test_flight', 'medical_emergency', 'military', 'vip_executive', 'humanitarian_relief', 'general_aviation', 'airshow', 'other')),
  CONSTRAINT `live_flights_time_pair` CHECK (
    (`scheduled_departure` IS NULL AND `scheduled_arrival` IS NULL)
    OR (`scheduled_departure` IS NOT NULL AND `scheduled_arrival` IS NOT NULL AND `scheduled_arrival` > `scheduled_departure`)
  ),
  CONSTRAINT `live_flights_positive_queue_order` CHECK (`queue_order` IS NULL OR `queue_order` > 0),
  CONSTRAINT `live_flights_reserved_queue_order` CHECK (`status` NOT IN ('approved', 'in_progress') OR `queue_order` IS NOT NULL),
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
