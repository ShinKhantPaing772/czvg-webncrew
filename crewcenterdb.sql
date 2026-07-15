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
);

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
  `multi` int NOT NULL,
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

ALTER TABLE `pireps` ADD FOREIGN KEY (`multi`) REFERENCES `multipliers` (`code`);

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
