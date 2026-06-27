# Changelog

## [Unreleased] - 2026-06-27

### Added
- v2 multi-container Alpine stack rewrite (mariadb, redis, postfix, dovecot, rspamd, opendkim, opendmarc, clamav, fail2ban, roundcube, manager-api, manager-ui)
- MariaDB image bootstraps the 7 production tables 1:1 (utf8_general_ci, InnoDB, FK CASCADE) plus an additive RefreshTokens table and Accounts auth columns
- SQL triggers auto-create VirtualQuotaUsers / VirtualQuotaDomains rows on user / domain creation and keep VirtualQuotaDomains aggregates in sync on every per-user write
- Dovecot dict-sql quota backend wired to VirtualQuotaUsers so every LMTP delivery and IMAP expunge updates the BDD live (parity with v1 production behaviour)
- Postfix MySQL maps for virtual_mailbox_domains / virtual_mailbox_maps / virtual_alias_maps / sender_login + sender blacklist (SieveRejectSenders consumed at SMTP time)
- Postfix recipient quota policy through dovecot quota-status (BDD-driven over-quota rejection)
- Milter chain opendkim:8891 -> opendmarc:8893 -> rspamd:11332 with milter_default_action=accept
- OpenDMARC stores history records in the dedicated `opendmarc` database (created alongside `roundcube`)
- Rspamd anti-spam with Redis backend, controller web UI on host loopback
- Default sieve script routes X-Spam:YES / X-Spam-Score>=5 mail to Junk
- manager-api NestJS 11 (TypeORM entities matching v1 schema, JWT + refresh tokens, Zod validation, Swagger at /api/docs, SHA512-CRYPT for mailbox passwords via openssl)
- manager-ui Nuxt 3 + Nuxt UI v4 with login + domains / users / aliases / quotas / sieve pages, Pinia persisted auth, Nitro proxy /api -> manager-api
- install.sh: idempotent secrets + bcrypt admin account; service.sh wrapper for docker compose

### Compatibility
- DB schema (column names, types, defaults, FK CASCADE, last_activity ON UPDATE) is byte-identical to the v1 production dump
- Maildir layout `/var/mail/vhosts/<domain>/<user>/{cur,new,tmp,sieve,...}` preserved, Maildir++ default layout, owner vmail:vmail (5000:5000)
- VirtualUsers.password stays SHA512-CRYPT
- VirtualQuotaUsers / VirtualQuotaDomains updated live by dovecot on every LMTP delivery (no maildirsize-only fallback)
