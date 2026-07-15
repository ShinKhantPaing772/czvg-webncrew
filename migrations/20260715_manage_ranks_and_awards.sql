-- Presentation fields used by the public rank ladder.
ALTER TABLE `ranks`
  ADD COLUMN `imageurl` TEXT NULL,
  ADD COLUMN `barcount` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN `bartone` VARCHAR(10) NOT NULL DEFAULT 'gold',
  ADD COLUMN `starcount` TINYINT UNSIGNED NOT NULL DEFAULT 0;

-- Preserve the rank artwork and insignia currently shown on the public site.
UPDATE `ranks`
SET `imageurl` = 'https://global.discourse-cdn.com/infiniteflight/original/4X/9/f/d/9fddae7f609a83f4d5f0f0b9cecfe41fce096836.png',
    `barcount` = 1,
    `bartone` = 'white',
    `starcount` = 0
WHERE LOWER(`name`) = 'trainee second officer';

UPDATE `ranks`
SET `imageurl` = CASE LOWER(`name`)
  WHEN 'second officer' THEN 'https://global.discourse-cdn.com/infiniteflight/original/4X/7/6/2/762e27e54b98ad4c9c894fca9ee8c1dfa994affb.png'
  WHEN 'first officer' THEN 'https://global.discourse-cdn.com/infiniteflight/original/4X/7/c/0/7c0231e4927f43356d12e9e839d1fd21183c49de.png'
  WHEN 'sr first officer' THEN 'https://global.discourse-cdn.com/infiniteflight/original/4X/7/e/7/7e774e9d23860935ce53d0d8f8ca8624a9f5d214.png'
  WHEN 'captain' THEN 'https://global.discourse-cdn.com/infiniteflight/original/4X/0/4/0/0401c2231ffaac4ddfeac1309ce8f7f134f65991.png'
  WHEN 'sr captain' THEN 'https://global.discourse-cdn.com/infiniteflight/original/4X/9/7/d/97dc473f7f9d9520e894038c9048b2ae8b2eadab.png'
  WHEN 'fleet captain' THEN 'https://global.discourse-cdn.com/infiniteflight/optimized/4X/1/d/4/1d49408bf5b2a652de2fe4feccb091a8a485f6f1_2_1640x418.png'
  ELSE `imageurl`
END,
`barcount` = CASE LOWER(`name`)
  WHEN 'first officer' THEN 2
  WHEN 'sr first officer' THEN 3
  WHEN 'captain' THEN 4
  WHEN 'sr captain' THEN 4
  WHEN 'fleet captain' THEN 4
  ELSE `barcount`
END,
`starcount` = CASE LOWER(`name`)
  WHEN 'sr captain' THEN 1
  WHEN 'fleet captain' THEN 2
  ELSE `starcount`
END
WHERE LOWER(`name`) IN (
  'second officer',
  'first officer',
  'sr first officer',
  'captain',
  'sr captain',
  'fleet captain'
);

-- A nullable unique flag allows at most one featured award in MySQL.
ALTER TABLE `awards`
  ADD COLUMN `featured` TINYINT NULL DEFAULT NULL,
  ADD UNIQUE KEY `awards_one_featured` (`featured`);

UPDATE `awards`
SET `featured` = 1
WHERE LOWER(`name`) = 'ceo''s award'
LIMIT 1;

-- Retain the oldest grant when historical duplicate rows exist.
DELETE duplicate_grant
FROM `awards_granted` duplicate_grant
INNER JOIN `awards_granted` retained_grant
  ON retained_grant.`pilotid` = duplicate_grant.`pilotid`
 AND retained_grant.`awardid` = duplicate_grant.`awardid`
 AND retained_grant.`id` < duplicate_grant.`id`;

ALTER TABLE `awards_granted`
  ADD UNIQUE KEY `awards_granted_pilot_award` (`pilotid`, `awardid`);
