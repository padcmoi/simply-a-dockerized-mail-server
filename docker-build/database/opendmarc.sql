-- OpenDMARC database schema
--
-- Copyright (c) 2012, 2016, 2018, 2021, The Trusted Domain Project.
-- 	All rights reserved.
-- download original at https://github.com/trusteddomainproject/OpenDMARC/blob/master/db/schema.mysql
-- and fixes by Julien Jean
CREATE DATABASE IF NOT EXISTS opendmarc;


USE opendmarc;


-- A table for mapping domain names and their DMARC policies to IDs
CREATE TABLE
  IF NOT EXISTS `domains` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `name` varchar(255) NOT NULL,
    `firstseen` timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `name` (`name`)
  );


-- A table for logging encountered ARC selectors
CREATE TABLE
  IF NOT EXISTS `selectors` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `domain` int(11) NOT NULL,
    `name` varchar(255) NOT NULL,
    `firstseen` timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `name_2` (`name`, `domain`),
    KEY `name` (`name`)
  );


-- A table for logging ARC-Authentication-Results information
CREATE TABLE
  IF NOT EXISTS `arcauthresults` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `message` int(10) UNSIGNED NOT NULL,
    `instance` int(10) UNSIGNED NOT NULL,
    `arc_client_addr` varchar(64) NOT NULL DEFAULT '',
    PRIMARY KEY (`id`),
    UNIQUE KEY `message_2` (`message`, `instance`),
    KEY `message` (`message`)
  );


-- A table for logging ARC-Seal information
CREATE TABLE
  IF NOT EXISTS `arcseals` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `message` int(10) UNSIGNED NOT NULL,
    `domain` int(10) UNSIGNED NOT NULL,
    `selector` int(10) UNSIGNED NOT NULL,
    `instance` int(10) UNSIGNED NOT NULL,
    `firstseen` timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `message_2` (`message`, `domain`, `selector`, `instance`),
    KEY `message` (`message`)
  );


-- A table for logging reporting requests
CREATE TABLE
  IF NOT EXISTS `requests` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `domain` int(11) NOT NULL,
    `repuri` varchar(255) NOT NULL DEFAULT '',
    `adkim` tinyint(4) NOT NULL DEFAULT 0,
    `aspf` tinyint(4) NOT NULL DEFAULT 0,
    `policy` tinyint(4) NOT NULL DEFAULT 0,
    `spolicy` tinyint(4) NOT NULL DEFAULT 0,
    `pct` tinyint(4) NOT NULL DEFAULT 0,
    `locked` tinyint(4) NOT NULL DEFAULT 0,
    `firstseen` timestamp NOT NULL DEFAULT current_timestamp(),
    `lastsent` timestamp NOT NULL DEFAULT '1970-01-01 00:00:01',
    PRIMARY KEY (`id`),
    UNIQUE KEY `domain` (`domain`),
    KEY `lastsent` (`lastsent`)
  );


-- A table for reporting hosts
CREATE TABLE
  IF NOT EXISTS `reporters` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `name` varchar(255) NOT NULL,
    `firstseen` timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `name` (`name`)
  );


-- A table for connecting client IP addresses
CREATE TABLE
  IF NOT EXISTS `ipaddr` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `addr` varchar(64) NOT NULL,
    `firstseen` timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `addr` (`addr`)
  );


-- A table for messages
CREATE TABLE
  IF NOT EXISTS `messages` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `date` timestamp NOT NULL DEFAULT current_timestamp(),
    `jobid` varchar(128) NOT NULL,
    `reporter` int(10) UNSIGNED NOT NULL,
    `policy` tinyint(3) UNSIGNED NOT NULL,
    `disp` tinyint(3) UNSIGNED NOT NULL,
    `ip` int(10) UNSIGNED NOT NULL,
    `env_domain` int(10) UNSIGNED NOT NULL,
    `from_domain` int(10) UNSIGNED NOT NULL,
    `policy_domain` int(10) UNSIGNED NOT NULL,
    `spf` tinyint(4) NOT NULL,
    `align_dkim` tinyint(3) UNSIGNED NOT NULL,
    `align_spf` tinyint(3) UNSIGNED NOT NULL,
    `sigcount` tinyint(3) UNSIGNED NOT NULL,
    `arc` tinyint(3) UNSIGNED NOT NULL,
    `arc_policy` tinyint(3) UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `reporter` (`reporter`, `date`, `jobid`),
    KEY `date` (`date`)
  );


-- A table for signatures
CREATE TABLE
  IF NOT EXISTS `signatures` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `message` int(10) UNSIGNED NOT NULL,
    `domain` int(10) UNSIGNED NOT NULL,
    `selector` int(10) UNSIGNED NOT NULL,
    `pass` tinyint(3) UNSIGNED NOT NULL,
    `error` tinyint(3) UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    KEY `message` (`message`)
  );


CREATE USER IF NOT EXISTS opendmarc@localhost IDENTIFIED BY '____mailRootPass';
GRANT ALL PRIVILEGES ON opendmarc.* TO opendmarc@localhost IDENTIFIED BY '____mailRootPass';
