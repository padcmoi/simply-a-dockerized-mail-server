# Changelog

## [Unreleased] - yyyy-mm-dd

### Added

- v2.0.0 scaffold : multi-container architecture (mariadb, redis, postfix, dovecot, rspamd, opendkim, opendmarc, clamav, roundcube, fail2ban, manager-api)
- `install.sh` orchestrates secrets generation, template hydration and volumes preparation
- `templates/` holds versioned config templates with `____placeholders` (mirror of 1.x.x `docker-build/conf.d`)
- `runtime/config/` is the hydrated output, bind-mounted into each container (gitignored)
- `.secrets/` holds generated persistent secrets (mariadb root password, roundcube DES key, manager-api JWT signing secret)
- `service.sh` wrapper around `docker compose` : `up`/`down`/`restart`/`rebuild`/`logs`/`ps`/`exec`/`shell` with profile persistence (`enable`/`disable` write to `.profiles`, applied automatically on every call)
- Postfix milters declared explicitly in main.cf (no more sequential sed appends across setup.d scripts)
- ClamAV and OpenDMARC behind compose profiles (opt-in, ClamAV optional to avoid kswapd on low-memory hosts)
- `manager-api/` : NestJS 11 admin API scaffold (TypeORM + Auth0 RS256/JWKS + helmet + throttler + swagger + env validation strict)
- Auth0 as the identity provider : SSO ready (Google connection), MFA, refresh tokens delegated. manager-api only VALIDATES tokens, no shared secret to manage
- URI versioning convention : all routes mounted at `/api/v<n>` via `setGlobalPrefix('api')` + `enableVersioning({ type: URI, defaultVersion: '1' })`, controllers use `@Version('1')`
- `manager-api/src/infra/` : control plane services (PostfixService, OpendkimService, Fail2banService, RspamdService, DovecotService, LogsService) ; manager-api gets read-write Docker socket access so the API can `postfix reload`, generate DKIM keys, ban/unban IPs, learn spam, tail logs without SSH or external scripts
- `manager-api/src/auth/` : Auth0Strategy + JwtAuthGuard + RolesGuard (`@Roles('admin'|'owner'|'user')`)
- `manager-api` is designed as a public-facing API : Nuxt frontend `manager-ui` is just one consumer ; external clients use the same Auth0 JWT
- Every service runs on a pinned image (no Debian as build base). Choices :
  - mariadb : `mariadb:10.5.29` (official, = prod version)
  - redis : `redis:6.0.20-alpine` (official, = bullseye native)
  - rspamd : `rspamd/rspamd:3.11.1` (official)
  - clamav : `clamav/clamav:1.4.1` (official, opt-in profile)
  - roundcube : `roundcube/roundcubemail:1.6.x-apache` (official)
  - opendkim : `instrumentisto/opendkim:2.11.0` (community, Alpine)
  - opendmarc : `instrumentisto/opendmarc:1.4.2` (community, Alpine, opt-in profile)
  - fail2ban : `crazymax/fail2ban:1.0.2` (community, Alpine)
  - postfix : custom thin layer `mail-postfix:v2.0.0` from `alpine:3.20` + `postfix postfix-mysql postfix-pcre` (no upstream image bundles MySQL + PCRE + writable bind-mount config)
  - dovecot : custom thin layer `mail-dovecot:v2.0.0` from `alpine:3.20` + `dovecot dovecot-mysql dovecot-lmtpd dovecot-pop3d dovecot-pigeonhole-plugin` (no upstream image guarantees the dovecot-mysql plugin)
  - manager-api : custom build (this IS our app)
- All custom Dockerfiles are Alpine-based ; postfix and dovecot both create `postfix=100` + `vmail=5000` fixed UIDs so the shared `postfix-spool` unix sockets (LMTP + SASL) work across containers
- All hydrated config files are bind-mounted READ-ONLY into the relevant container, copied to the proper location by each entrypoint
- `install.sh` post-hydration patch : MySQL connect host rewritten from `localhost`/`127.0.0.1` to `mariadb` in `mysql-virtual-*.cf` and `_mysql-connect.conf` (user `root` and SYSTEM_PASSWORD unchanged - compat lock holds)
- `MIGRATION.md` : zero data loss procedure from 1.x.x prod (volumes preserve, SYSTEM_PASSWORD must be ported before `install.sh`)
- All source files passed through `prettier 3` (TS, JSON, YAML, MD)
- TypeORM entities mapped on the 7 prod tables (`Accounts`, `VirtualDomains`, `VirtualUsers`, `VirtualAliases`, `VirtualQuotaDomains`, `VirtualQuotaUsers`, `SieveRejectSenders`) with `synchronize=false`
- MariaDB pinned to `10.5.29` (exact prod version, no upgrade jump at migration time ; future upgrade gated by `MARIADB_AUTO_UPGRADE=1` when desired)
- Redis pinned to `6.0.20-alpine` (matches what Debian bullseye ships, as installed in 1.x.x monolith)
- Custom Dockerfiles base on `debian:bullseye` (same OS family as prod) so apt-installed postfix/dovecot/opendkim/opendmarc/fail2ban resolve to the same packages prod runs today
- Roundcube and Rspamd UI bound to `127.0.0.1` only, fronted by host nginx reverse proxy
- manager-api exposed on `127.0.0.1:4003` (HTTP, TLS terminated by reverse proxy)

### Changed

- Mail server is no longer a single Debian-bullseye monolith with 15 chained `setup.d` scripts
- Web management is API-first (NestJS) + Nuxt frontend, replacing the previous `menu.sh` bash interface
- Root account credentials never persisted on disk : `install.sh` generates email + password in memory only, inserts via the `99_webadmin_accounts.sql` bootstrap (run once on fresh MariaDB datadir), and prints them ONCE to TTY at the end of install. The DB (`webadmin_accounts` table) is the single source of truth, queried by manager-api at login. Bootstrap is skipped on re-installs once MariaDB datadir is initialized.
- `manager-api/tsconfig.json` : explicit `rootDir: ./src` (silences TS warning when `include` covers a single source root) ; deprecated `baseUrl` removed (no `paths` mapping consumed it)

### Compatibility

- BDD schema, Maildir paths, password scheme SHA512-CRYPT, ports 25/143/465/587/993 identical to 1.x.x
- SQL templates `templates/mariadb/init/*.sql` byte-identical to 1.x.x `docker-build/database/`
- `templates/` configs are copies of 1.x.x `docker-build/conf.d/` with the same `____placeholders`

## [1.1.2] - 2025-01-31

### Added

- Adds the first changelog
- Antivirus scanning can be done with a remote server, this choice is made in the environment file, 0=disabled, 1=enabled locally, 2=enabled on remote server

### Changed

- Reduces the risk of server crashes due to the antivirus consuming too many resources on a server with low memory capacity. This could cause a crash due to kswap. Now, antivirus scanning can be offloaded to a remote server.

### Fixed

- Antivirus crash and host machine crash (kswapd)

### Refactor

- Logs are now in real-time in the menu script, to exit press ctrl+c
