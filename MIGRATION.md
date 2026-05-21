# Migration 1.x.x -> 2.0.0

Zero data loss path. Every existing domain, recipient, alias, mailbox and DKIM key must keep working after switching to v2.

## What MUST be preserved on disk

Source paths on the 1.x.x host (Docker volume root, then container subpath) :

| 1.x.x volume mount | Contents | v2 target volume |
|---|---|---|
| `$DOCKER_VOLUMES/mysql` | `/var/lib/mysql` - MariaDB datafiles (mailserver + opendmarc + roundcube DBs) | same |
| `$DOCKER_VOLUMES/mail` | `/var/mail/vhosts/<domain>/<localpart>/` - Maildirs | same |
| `$DOCKER_VOLUMES/opendkim` | `/etc/opendkim/keys/<domain>/dkim_YYYY_MM.{private,txt}` + KeyTable/SigningTable/TrustedHosts | same |
| `$DOCKER_VOLUMES/ssl` | `/etc/_private/{fullchain,privkey}.pem` | same |
| `$DOCKER_VOLUMES/postfix` | `/var/spool/postfix/` - mail queue | renamed to `postfix-spool` |
| `$DOCKER_VOLUMES/postscreen` | `/etc/_postscreen/postscreen_access.cidr` | folded into postfix config bind |
| `$DOCKER_VOLUMES/redis` | `/var/lib/redis/` - Rspamd bayes corpus | same |
| `$DOCKER_VOLUMES/rspamd` | `/var/lib/rspamd/` | same |
| `$DOCKER_VOLUMES/clamav` | `/var/lib/clamav/` | same |
| `$DOCKER_VOLUMES/fail2ban` | `/var/lib/fail2ban/` | same |
| `$DOCKER_VOLUMES/opendmarc` | `/var/opendmarc/` | same |
| `$DOCKER_VOLUMES/log` | `/var/log/` | same |

The MariaDB image is pinned to `10.5.29` (identical to prod) so the datafiles boot without any in-place upgrade. A future upgrade to 10.11+ is opt-in : change the tag in `docker-compose.yml` and add `MARIADB_AUTO_UPGRADE: "1"` back to the environment block ; the upgrade then runs once at next boot.

## What MUST stay identical at the application level

- The `mailserver` DB schema (7 tables : `Accounts`, `VirtualDomains`, `VirtualUsers`, `VirtualAliases`, `VirtualQuotaDomains`, `VirtualQuotaUsers`, `SieveRejectSenders`). v2 entities are mapped with `synchronize=false` so TypeORM never touches them.
- The Dovecot `mail_location = maildir:/var/mail/vhosts/%d/%n/` and the column `VirtualUsers.maildir` format `<domain>/<localpart>/`.
- The Dovecot `default_pass_scheme = SHA512-CRYPT` (`$6$...$...` hashes). v2 keeps Dovecot using these for IMAP/SMTP login. **Auth0** is a separate channel for webadmin login - it does not replace mailbox auth.
- The OpenDKIM selector convention `dkim_YYYY_MM`.
- The Postfix and Dovecot MySQL connect strings : `user = root`, `password = <SYSTEM_PASSWORD>` (the legacy 50-char system password stored in `.secrets/system_password`). **DO NOT** change to `mailuser`.
- The Postfix <-> Dovecot LMTP and SASL transport stays on unix sockets in the shared `postfix-spool` volume.

## Migration procedure (offline cutover, ~15-30 min downtime)

1. **Backup 1.x.x** - on the 1.x.x host :
   ```bash
   ./menu.sh   # use the backup option, produces backup-mailserver-YYYY_MM_DD.tar.gz
   ```
   Optionally also `mysqldump --all-databases > full.sql` for a logical snapshot.

2. **Stop 1.x.x** :
   ```bash
   docker compose down   # 1.x.x project root
   ```

3. **Capture the 50-char SYSTEM_PASSWORD** from inside the 1.x.x volume (it lived at `/.system_password` inside the running container, captured into your old `mysql-virtual-*.cf`). On 1.x.x host:
   ```bash
   grep -h '^password' $DOCKER_VOLUMES/...  # or read it from a 1.x.x backup tarball
   ```
   Stash it into the v2 `.secrets/system_password` BEFORE running v2 `install.sh`, otherwise install.sh will generate a fresh one and break the existing MariaDB root credential :
   ```bash
   echo -n "<the 50 chars from 1.x.x>" > <v2-root>/.secrets/system_password
   chmod 600 <v2-root>/.secrets/system_password
   ```

4. **Move volumes to v2 layout** - on the v2 host (could be the same host) :
   ```bash
   # Copy or move the 1.x.x volume tree to the v2 DOCKER_VOLUMES path.
   # If you keep the path, just point the v2 .env DOCKER_VOLUMES at the same dir.
   # Rename only postfix -> postfix-spool :
   mv $DOCKER_VOLUMES/postfix $DOCKER_VOLUMES/postfix-spool
   ```

5. **Configure v2 `.env`** - copy `.env.sample` to `.env`, set :
   - `DOMAIN_FQDN` = same FQDN
   - `ADRESSIP` = host public IP
   - `ADMIN_PASSWORD` = same as 1.x.x (used by Roundcube/manager-api as `mailuser` password)
   - DKIM/DMARC/Fail2ban values per 1.x.x
   - Auth0 vars : create an Auth0 tenant + application + API, fill `AUTH0_DOMAIN` / `AUTH0_AUDIENCE` / `AUTH0_ISSUER`

6. **Run install.sh** :
   ```bash
   ./install.sh
   ```
   This hydrates `runtime/config/`, generates `.secrets/roundcube_des_key` (24 chars - if you want to preserve roundcube sessions, restore the 1.x.x DES key before running install.sh, otherwise users will be re-prompted to log in).

7. **Boot v2** :
   ```bash
   docker compose up -d
   ```

8. **Verify** before announcing the cutover :
   - `docker compose ps` : all services healthy
   - Send a test mail from an external account to one of the imported recipients
   - Login via IMAP/SMTP with a known account (existing SHA512-CRYPT password must work)
   - Roundcube login on `127.0.0.1:4080`
   - `docker compose exec mariadb mysql -u root -p mailserver -e "SELECT COUNT(*) FROM VirtualUsers"` returns the prod count

9. **Optional ClamAV** (off by default to spare RAM) :
   ```bash
   docker compose --profile clamav up -d
   ```

## Rollback

If anything looks off after step 7 :
```bash
docker compose down
# Restore your backup tarball over $DOCKER_VOLUMES
# Switch back to 1.x.x (master branch) and `docker compose up -d`
```
The 1.x.x branch (`master`) is preserved untouched ; rollback is just a `git checkout` + `docker compose up` on the 1.x.x compose file.

## What changes for users

Nothing visible :

- Mail clients keep the same server (`docker.naskot.fr`), same ports (25/465/587/143/993), same passwords
- Roundcube URL unchanged (reverse proxy stays in front)
- DNS records (MX, SPF, DKIM, DMARC) unchanged
