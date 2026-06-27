-- =============================================================================
-- mailserver schema, byte-identical to the v1 production dump:
--   - charset utf8 / collation utf8_general_ci on every original table
--   - InnoDB engine
--   - FK CASCADE on domain/email so cleanups stay coherent
--   - last_activity ON UPDATE current_timestamp() everywhere it existed
-- A v1 dump can be `mariadb mailserver < dump.sql` imported on top without edits.
-- =============================================================================

USE `mailserver`;

CREATE TABLE IF NOT EXISTS `VirtualDomains` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `owner_id` int(11) DEFAULT NULL,
  `domain` varchar(255) NOT NULL,
  `quota` bigint(20) NOT NULL DEFAULT 0,
  `active` tinyint(1) NOT NULL DEFAULT 0,
  `user_start_date` date NOT NULL DEFAULT '1970-01-01',
  `user_end_date` date DEFAULT NULL,
  `last_activity` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `domain` (`domain`),
  KEY `domain_2` (`domain`),
  KEY `owner_id` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

CREATE TABLE IF NOT EXISTS `VirtualUsers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `owner_id` int(11) DEFAULT NULL,
  `domain` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(128) NOT NULL,
  `maildir` char(50) NOT NULL,
  `quota` bigint(20) NOT NULL DEFAULT 0,
  `active` tinyint(1) NOT NULL DEFAULT 0,
  `uid` char(15) NOT NULL DEFAULT 'vmail',
  `gid` char(15) NOT NULL DEFAULT 'vmail',
  `user_start_date` date NOT NULL DEFAULT '1970-01-01',
  `user_end_date` date DEFAULT NULL,
  `last_activity` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `domain` (`domain`),
  KEY `owner_id` (`owner_id`),
  CONSTRAINT `VirtualUsers_ibfk_1` FOREIGN KEY (`domain`) REFERENCES `VirtualDomains` (`domain`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

CREATE TABLE IF NOT EXISTS `VirtualAliases` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `owner_id` int(11) DEFAULT NULL,
  `domain` varchar(255) NOT NULL,
  `source` varchar(255) NOT NULL,
  `destination` varchar(255) NOT NULL,
  `user_start_date` date NOT NULL DEFAULT '1970-01-01',
  `user_end_date` date DEFAULT NULL,
  `last_activity` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `source` (`source`),
  KEY `domain` (`domain`),
  KEY `owner_id` (`owner_id`),
  CONSTRAINT `VirtualAliases_ibfk_1` FOREIGN KEY (`domain`) REFERENCES `VirtualDomains` (`domain`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

CREATE TABLE IF NOT EXISTS `VirtualQuotaDomains` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `domain` varchar(255) NOT NULL,
  `bytes` bigint(20) NOT NULL DEFAULT 0,
  `messages` bigint(20) NOT NULL DEFAULT 0,
  `last_activity` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `domain` (`domain`),
  CONSTRAINT `VirtualQuotaDomains_ibfk_1` FOREIGN KEY (`domain`) REFERENCES `VirtualDomains` (`domain`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

CREATE TABLE IF NOT EXISTS `VirtualQuotaUsers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `domain` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `bytes` bigint(20) NOT NULL DEFAULT 0,
  `messages` bigint(20) NOT NULL DEFAULT 0,
  `last_activity` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `email` (`email`),
  KEY `domain` (`domain`),
  CONSTRAINT `VirtualQuotaUsers_ibfk_1` FOREIGN KEY (`email`) REFERENCES `VirtualUsers` (`email`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `VirtualQuotaUsers_ibfk_2` FOREIGN KEY (`domain`) REFERENCES `VirtualDomains` (`domain`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

CREATE TABLE IF NOT EXISTS `SieveRejectSenders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sender` varchar(255) NOT NULL,
  `enabled` int(11) NOT NULL DEFAULT 1,
  `date_creation` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sender` (`sender`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- Accounts table starts at the v1 schema (id, username) so a legacy dump
-- imports without edits. Extra columns required by manager-api are added in
-- 03-accounts-extra.sql with IF NOT EXISTS semantics.
CREATE TABLE IF NOT EXISTS `Accounts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
