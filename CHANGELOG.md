# Changelog

## [Unreleased] - 2026-06-27

### Added
- v2 multi-container Alpine stack rewrite (mariadb, redis, postfix, dovecot, rspamd, opendkim, opendmarc, clamav, fail2ban, roundcube, manager-api, manager-ui)
- manager-api TypeORM synchronize generates the 7 v1-compatible tables (utf8_general_ci, InnoDB, FK CASCADE, defaults and ON UPDATE timestamps byte-for-byte with v1) plus the additive RefreshTokens table; no SQL init scripts for the mail schema
- 5 quota triggers (auto-create VirtualQuotaUsers/Domains on user/domain insert, recompute VirtualQuotaDomains aggregates on every per-user write) installed by manager-api at boot via an OnApplicationBootstrap hook
- Dovecot dict-sql quota backend wired to VirtualQuotaUsers so every LMTP delivery and IMAP expunge updates the BDD live (parity with v1 production behaviour)
- Postfix MySQL maps for virtual_mailbox_domains / virtual_mailbox_maps / virtual_alias_maps / sender_login + sender blacklist (SieveRejectSenders consumed at SMTP time)
- Postfix recipient quota policy through dovecot quota-status (BDD-driven over-quota rejection)
- Milter chain opendkim:8891 -> opendmarc:8893 -> rspamd:11332 with milter_default_action=accept
- MariaDB init scripts split per auxiliary database: 01-roundcube.sh and 02-opendmarc.sh
- Rspamd anti-spam with Redis backend, controller web UI on host loopback
- Default sieve script routes X-Spam:YES / X-Spam-Score>=5 mail to Junk
- manager-api NestJS 11 (TypeORM entities matching v1 schema, JWT + refresh tokens, Zod validation, Swagger at /api/docs, SHA512-CRYPT for mailbox passwords via openssl)
- manager-ui Nuxt 3 + Nuxt UI v4 with login + domains / users / aliases / quotas / sieve pages, Pinia persisted auth, Nitro proxy /api -> manager-api
- Roundcube default language configurable via ROUNDCUBE_LANGUAGE (en_US, fr_FR, de_DE, ...) read by config.inc.php at runtime; install.sh accepts short aliases (fr, FR, en, de, es, it, pt, nl, ru, pl) on top of full xx_YY locales
- install.sh: one-shot interactive bootstrap (root required, refuses to run with an existing .env), prompts FQDN with Let's Encrypt cert presence check loop, auto-detected public IP, primary domain, first mailbox, Roundcube language, all regex-validated
- install.sh seeds the admin in Accounts, the primary domain in VirtualDomains, the first mailbox in VirtualUsers, generates the DKIM key for the primary domain and tees credentials + DKIM TXT record to INSTALL_INFO.txt (gitignored)
- DKIM keys are generated through a tiny Python stdlib HTTP sidecar (`dkim-api.py`) co-running with opendkim in the same container, reachable from the docker `mail` bridge only. manager-api calls it whenever the admin adds, rotates or removes a domain DKIM key. install.sh uses the same sidecar so there is a single DKIM code path for both the bootstrap domain and any subsequent domain
- New endpoints on manager-api: `POST /api/domains` returns the DKIM TXT record alongside the created domain; `GET /api/domains/:id/dkim` lists active selectors; `POST /api/domains/:id/dkim/rotate` adds a fresh selector without removing the previous one (DNS-rotation friendly); `DELETE /api/domains/:id/dkim?selector=...` removes a stale selector after the TTL has expired
- Selector pattern changed from `dkim_YYYY_MM` (underscores) to `dkim<YYYYMM>` (ascii pure) for compatibility with strict DNS UIs and legacy DKIM validators
- Prettier added to both manager-api and manager-ui with a shared style (singleQuote, no semi, trailingComma all, printWidth 110). Run with `pnpm format` (write) or `pnpm format:check` (CI-friendly)
- service.sh wrapper for docker compose
- INSTALL.md documents the one-shot installer flow end-to-end

### Fixed
- Sieve reject / redirect / vacation bounces now relay through a dedicated milter-free postfix port 10025 (mynetworks-only, no RBL, no SPF, no rspamd) so dovecot DSNs no longer get caught by the public-SMTP milter chain and the rejection actually reaches the original sender
- Dovecot healthcheck via `doveadm service status` (imap-login + lmtp); postfix and roundcube now wait for dovecot to report healthy so reloads no longer leave roundcube briefly stranded with "Erreur de connexion au serveur de stockage"
- install.sh DKIM step now parses the sidecar response with python3 inside the opendkim container instead of fragile grep on JSON. A previous regression where Python's default JSON formatter added whitespace made the grep return empty, dying before the summary block and leaving INSTALL_INFO.txt uncreated. The sidecar also emits compact JSON now as a belt-and-suspenders guard

### Compatibility
- DB schema (column names, types, defaults, FK CASCADE, last_activity ON UPDATE) is byte-identical to the v1 production dump
- Maildir layout `/var/mail/vhosts/<domain>/<user>/{cur,new,tmp,sieve,...}` preserved, Maildir++ default layout, owner vmail:vmail (5000:5000)
- VirtualUsers.password stays SHA512-CRYPT
- VirtualQuotaUsers / VirtualQuotaDomains updated live by dovecot on every LMTP delivery (no maildirsize-only fallback)
