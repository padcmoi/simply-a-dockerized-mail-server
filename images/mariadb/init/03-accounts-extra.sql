-- =============================================================================
-- Accounts table: additive columns required by the manager-api auth flow.
-- The v1 (id, username) shape stays intact and a legacy dump still imports.
-- =============================================================================

USE `mailserver`;

ALTER TABLE `Accounts` ADD COLUMN IF NOT EXISTS `password`   varchar(255) DEFAULT NULL;
ALTER TABLE `Accounts` ADD COLUMN IF NOT EXISTS `role`       varchar(32)  NOT NULL DEFAULT 'admin';
ALTER TABLE `Accounts` ADD COLUMN IF NOT EXISTS `enabled`    tinyint(1)   NOT NULL DEFAULT 1;
ALTER TABLE `Accounts` ADD COLUMN IF NOT EXISTS `last_login` datetime     DEFAULT NULL;
ALTER TABLE `Accounts` ADD COLUMN IF NOT EXISTS `created_at` datetime     NOT NULL DEFAULT current_timestamp();
ALTER TABLE `Accounts` ADD COLUMN IF NOT EXISTS `updated_at` datetime     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp();

CREATE TABLE IF NOT EXISTS `RefreshTokens` (
  `id`         int(11)      NOT NULL AUTO_INCREMENT,
  `account_id` int(11)      NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `ip`         varchar(45)  DEFAULT NULL,
  `expires_at` datetime     NOT NULL,
  `revoked_at` datetime     DEFAULT NULL,
  `created_at` datetime     NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `account_id` (`account_id`),
  CONSTRAINT `RefreshTokens_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `Accounts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
