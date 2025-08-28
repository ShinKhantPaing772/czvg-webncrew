-- Create tokens table for storing authentication tokens
CREATE TABLE `tokens` (
  `id` int PRIMARY KEY NOT NULL AUTO_INCREMENT,
  `pilotId` int NOT NULL,
  `token` varchar(255) NOT NULL UNIQUE,
  `expiresAt` datetime NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT (current_timestamp()),
  `updatedAt` datetime NOT NULL DEFAULT (current_timestamp()),
  `isRevoked` boolean NOT NULL DEFAULT false,
  FOREIGN KEY (`pilotId`) REFERENCES `pilots` (`id`) ON DELETE CASCADE
);

-- Add index for faster token lookups
CREATE INDEX `idx_tokens_token` ON `tokens` (`token`);

-- Add index for finding tokens by pilot
CREATE INDEX `idx_tokens_pilotId` ON `tokens` (`pilotId`);