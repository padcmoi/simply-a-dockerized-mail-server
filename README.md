# Simply a dockerized mail server - v2.0.0 (WIP)

Multi-container rewrite of the 1.x.x monolith. Goal : 100% compat on data (BDD, Maildir paths, SHA512-CRYPT passwords, client ports) while replacing the all-in-one Debian image with one container per service on pinned stable versions.

## Layout

```
install.sh           single entry-point : validates .env, generates secrets,
                     hydrates templates into runtime/config/, prepares volumes
docker-compose.yml   services declaration (mariadb, redis, postfix, dovecot,
                     rspamd, opendkim, opendmarc, clamav, roundcube, fail2ban)
.env.sample          mirror of 1.x.x env contract
templates/           versioned config files with ____placeholders
runtime/config/      hydrated output, bind-mounted read-only (gitignored)
.secrets/            persistent generated secrets (gitignored)
dockerfiles/         custom images (postfix, opendkim, opendmarc, fail2ban)
scripts/             runtime helpers (dkim-create.sh, ...)
```

## Usage

```bash
cp .env.sample .env
# edit .env

./install.sh             # idempotent : re-run after editing .env
docker compose up -d     # then bring services up

# Optional profiles
docker compose --profile clamav --profile opendmarc up -d
```

## Status

Scaffold and architecture in place. Every service runs on a pinned image - official upstream where possible (mariadb, redis, rspamd, clamav, roundcube), community Alpine-based where it makes sense (opendkim, opendmarc, fail2ban), thin custom Alpine layers only for postfix (needs postfix-mysql + postfix-pcre together) and dovecot (needs dovecot-mysql + sieve together). No Debian build base anywhere.

Templates copied verbatim from the 1.x.x `docker-build/conf.d/` ; placeholders hydrated by `install.sh`. SQL templates under `templates/mariadb/init/` are byte-identical to the 1.x.x ones - BDD schema is part of the compat contract.

Remaining work : verify the chosen community image tags actually exist on Docker Hub (`instrumentisto/opendkim:2.11.0`, `instrumentisto/opendmarc:1.4.2`, `crazymax/fail2ban:1.0.2`) and adjust if needed ; implement CRUD modules in `manager-api/` ; scaffold `manager-ui/` (Nuxt 3 + Tailwind + auth0-vue).
