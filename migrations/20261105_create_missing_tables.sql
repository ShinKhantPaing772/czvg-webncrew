-- Tables the app's models use that no other SQL file in this repo creates,
-- so a fresh database can be built from the repo alone.
-- Safe on an existing database: every statement is CREATE TABLE IF NOT
-- EXISTS, so tables that already exist are left exactly as they are.
-- The `tokens` table is defined in tokens.sql at the repo root.

-- Applicant portal record, one per pilot (model: Application).
CREATE TABLE IF NOT EXISTS `applications` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `pilotid` INT NOT NULL,
  `exam_status` TINYINT NOT NULL DEFAULT 0,
  `exam_score` DECIMAL(5,2) NULL DEFAULT NULL,
  `exam_completed_at` DATETIME NULL DEFAULT NULL,
  `exam_result_received_at` DATETIME NULL DEFAULT NULL,
  `flight_replay_url` TEXT NULL,
  `flight_replay_submitted_at` DATETIME NULL DEFAULT NULL,
  `discord_invite_url` TEXT NULL,
  `discord_invite_sent_at` DATETIME NULL DEFAULT NULL,
  `if_grade` INT NULL DEFAULT NULL,
  `if_violations` INT NULL DEFAULT NULL,
  `if_metrics_updated_at` DATETIME NULL DEFAULT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `applications_pilotid_unique` (`pilotid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Password-reset codes (model: OTP). `otp` holds a bcrypt hash of the code.
CREATE TABLE IF NOT EXISTS `otps` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `otp` VARCHAR(255) NOT NULL,
  `expires` DATETIME NOT NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `otps_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Short-lived Infinite Flight cache and rate-limit counters
-- (src/lib/utils/if-cache.ts). The app also creates this table on first
-- use; this copy is for database users that can't CREATE at runtime.
CREATE TABLE IF NOT EXISTS `api_cache` (
  `cache_key` VARCHAR(255) NOT NULL PRIMARY KEY,
  `value` LONGTEXT NOT NULL,
  `expires_at` BIGINT NOT NULL,
  KEY `idx_api_cache_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
