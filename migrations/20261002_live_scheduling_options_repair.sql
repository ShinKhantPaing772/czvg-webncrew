-- Run in the same database where the live scheduling tables were created.
-- Repairs the final migration step when the legacy options table is absent.
-- Existing tables and option values are preserved.
CREATE TABLE IF NOT EXISTS `options` (
  `name` VARCHAR(120) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO `options` (`name`, `value`)
VALUES ('live_scheduling_mutex', '1');

SELECT `name`, `value` FROM `options`
WHERE `name` = 'live_scheduling_mutex';
