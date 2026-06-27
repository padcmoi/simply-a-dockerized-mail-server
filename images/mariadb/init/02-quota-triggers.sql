-- =============================================================================
-- Quota glue triggers.
--
-- Goal: dovecot writes per-mailbox counters via dict-sql (UPDATE on
-- VirtualQuotaUsers); MariaDB takes care of:
--   (a) seeding the VirtualQuotaUsers and VirtualQuotaDomains rows whenever a
--       new VirtualUsers / VirtualDomains row appears, so dovecot's dict UPDATE
--       always finds an existing row to update; and
--   (b) keeping VirtualQuotaDomains.bytes/messages in sync as the sum of the
--       VirtualQuotaUsers rows for the same domain, with last_activity bumped
--       on every change.
--
-- This way the BDD remains the single source of truth for both per-user and
-- per-domain quotas, matching the v1 production behaviour 1:1.
-- =============================================================================

USE `mailserver`;

DELIMITER //

-- Auto-create the matching VirtualQuotaUsers row when a mailbox is created.
DROP TRIGGER IF EXISTS `VirtualUsers_after_insert_quota`//
CREATE TRIGGER `VirtualUsers_after_insert_quota`
AFTER INSERT ON `VirtualUsers`
FOR EACH ROW
BEGIN
  INSERT IGNORE INTO `VirtualQuotaUsers` (`domain`, `email`, `bytes`, `messages`)
  VALUES (NEW.`domain`, NEW.`email`, 0, 0);
END//

-- Auto-create the matching VirtualQuotaDomains row when a domain is created.
DROP TRIGGER IF EXISTS `VirtualDomains_after_insert_quota`//
CREATE TRIGGER `VirtualDomains_after_insert_quota`
AFTER INSERT ON `VirtualDomains`
FOR EACH ROW
BEGIN
  INSERT IGNORE INTO `VirtualQuotaDomains` (`domain`, `bytes`, `messages`)
  VALUES (NEW.`domain`, 0, 0);
END//

-- Recompute domain aggregate on every per-user quota write.
DROP TRIGGER IF EXISTS `VirtualQuotaUsers_after_update_agg`//
CREATE TRIGGER `VirtualQuotaUsers_after_update_agg`
AFTER UPDATE ON `VirtualQuotaUsers`
FOR EACH ROW
BEGIN
  UPDATE `VirtualQuotaDomains`
  SET `bytes`    = COALESCE((SELECT SUM(`bytes`)    FROM `VirtualQuotaUsers` WHERE `domain` = NEW.`domain`), 0),
      `messages` = COALESCE((SELECT SUM(`messages`) FROM `VirtualQuotaUsers` WHERE `domain` = NEW.`domain`), 0)
  WHERE `domain` = NEW.`domain`;
END//

DROP TRIGGER IF EXISTS `VirtualQuotaUsers_after_insert_agg`//
CREATE TRIGGER `VirtualQuotaUsers_after_insert_agg`
AFTER INSERT ON `VirtualQuotaUsers`
FOR EACH ROW
BEGIN
  UPDATE `VirtualQuotaDomains`
  SET `bytes`    = COALESCE((SELECT SUM(`bytes`)    FROM `VirtualQuotaUsers` WHERE `domain` = NEW.`domain`), 0),
      `messages` = COALESCE((SELECT SUM(`messages`) FROM `VirtualQuotaUsers` WHERE `domain` = NEW.`domain`), 0)
  WHERE `domain` = NEW.`domain`;
END//

DROP TRIGGER IF EXISTS `VirtualQuotaUsers_after_delete_agg`//
CREATE TRIGGER `VirtualQuotaUsers_after_delete_agg`
AFTER DELETE ON `VirtualQuotaUsers`
FOR EACH ROW
BEGIN
  UPDATE `VirtualQuotaDomains`
  SET `bytes`    = COALESCE((SELECT SUM(`bytes`)    FROM `VirtualQuotaUsers` WHERE `domain` = OLD.`domain`), 0),
      `messages` = COALESCE((SELECT SUM(`messages`) FROM `VirtualQuotaUsers` WHERE `domain` = OLD.`domain`), 0)
  WHERE `domain` = OLD.`domain`;
END//

DELIMITER ;
