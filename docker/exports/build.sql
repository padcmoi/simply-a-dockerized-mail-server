USE mailserver;

-- DROP TABLE IF EXISTS `Accounts`,
-- `VirtualAliases`,
-- `VirtualDomains`,
-- `VirtualQuotaDomains`,
-- `VirtualQuotaUsers`,
-- `VirtualUsers`;
--
CREATE TABLE
  IF NOT EXISTS `Accounts` (
    `id` int (11) NOT NULL AUTO_INCREMENT,
    `username` varchar(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY (`username`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8 COLLATE = utf8_general_ci;

CREATE TABLE
  IF NOT EXISTS `VirtualDomains` (
    `id` int (11) NOT NULL AUTO_INCREMENT,
    `owner_id` int (11) DEFAULT NULL,
    `domain` varchar(255) NOT NULL,
    `active` tinyint (1) NOT NULL DEFAULT 0,
    `user_start_date` date NOT NULL DEFAULT '1970-01-01',
    `user_end_date` date DEFAULT NULL,
    `last_activity` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`),
    KEY (`domain`),
    KEY (`owner_id`),
    FOREIGN KEY (`owner_id`) REFERENCES `Accounts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8 COLLATE = utf8_general_ci;

CREATE TABLE
  IF NOT EXISTS `VirtualUsers` (
    `id` int (11) NOT NULL AUTO_INCREMENT,
    `owner_id` int (11) DEFAULT NULL,
    `domain` varchar(255) NOT NULL,
    `email` varchar(255) NOT NULL,
    `password` varchar(128) NOT NULL,
    `maildir` char(50) NOT NULL,
    `quota` char(50) NOT NULL DEFAULT '0',
    `active` tinyint (1) NOT NULL DEFAULT 0,
    `uid` char(15) NOT NULL DEFAULT 'vmail',
    `gid` char(15) NOT NULL DEFAULT 'vmail',
    `user_start_date` date NOT NULL DEFAULT '1970-01-01',
    `user_end_date` date DEFAULT NULL,
    `last_activity` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `email` (`email`),
    KEY (`domain`),
    KEY (`owner_id`),
    FOREIGN KEY (`domain`) REFERENCES `VirtualDomains` (`domain`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`owner_id`) REFERENCES `Accounts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8 COLLATE = utf8_general_ci;

CREATE TABLE
  IF NOT EXISTS `VirtualQuotaDomains` (
    `id` int (11) NOT NULL AUTO_INCREMENT,
    `domain` varchar(255) NOT NULL,
    `bytes` bigint (20) NOT NULL DEFAULT 0,
    `messages` int (11) NOT NULL DEFAULT 0,
    `last_activity` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`),
    KEY (`domain`),
    FOREIGN KEY (`domain`) REFERENCES `VirtualDomains` (`domain`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8 COLLATE = utf8_general_ci;

CREATE TABLE
  IF NOT EXISTS `VirtualQuotaUsers` (
    `id` int (11) NOT NULL AUTO_INCREMENT,
    `domain` varchar(255) NOT NULL,
    `email` varchar(255) NOT NULL,
    `bytes` bigint (20) NOT NULL DEFAULT 0,
    `messages` int (11) NOT NULL DEFAULT 0,
    `last_activity` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`),
    KEY (`email`),
    KEY (`domain`),
    FOREIGN KEY (`email`) REFERENCES `VirtualUsers` (`email`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`domain`) REFERENCES `VirtualDomains` (`domain`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8 COLLATE = utf8_general_ci;

CREATE TABLE
  IF NOT EXISTS `VirtualAliases` (
    `id` int (11) NOT NULL AUTO_INCREMENT,
    `owner_id` int (11) DEFAULT NULL,
    `domain` varchar(255) NOT NULL,
    `source` varchar(255) NOT NULL,
    `destination` varchar(255) NOT NULL,
    `user_start_date` date NOT NULL DEFAULT '1970-01-01',
    `user_end_date` date DEFAULT NULL,
    `last_activity` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `source` (`source`),
    KEY (`domain`),
    KEY (`owner_id`),
    FOREIGN KEY (`domain`) REFERENCES `VirtualDomains` (`domain`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`owner_id`) REFERENCES `Accounts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8 COLLATE = utf8_general_ci;
