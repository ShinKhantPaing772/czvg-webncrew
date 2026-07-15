-- Manual aircraft are not linked to Infinite Flight reference data.
-- MODIFY is safe to run again because it converges on the same definition.
ALTER TABLE `aircraft`
  MODIFY COLUMN `ifaircraftid` TEXT NULL;
