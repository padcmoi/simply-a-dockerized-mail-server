# Installation guide

## 1. Prerequisites

| Requirement             | Notes |
| ----------------------- | ----- |
| Docker Engine 24+       | with the `docker compose` plugin |
| Public IPv4             | with PTR pointing to `<MAIL_HOSTNAME>` |
| Open inbound ports      | 25, 465, 587, 993 |
| TLS certificate         | **mandatory**, must exist at `/etc/letsencrypt/live/<MAIL_HOSTNAME>/{fullchain,privkey}.pem` before running `install.sh` |
| Host nginx (optional)   | for reverse-proxying the manager UI / roundcube to loopback ports |

Get the certificate first:

```bash
sudo certbot certonly --standalone -d mail.example.com
```

(port 80 must be free) or use your existing nginx with `certbot --nginx`
or `--webroot`. `install.sh` aborts immediately if the cert is missing.

## 2. Run the installer

One command. The script asks for the FQDN, the public IPv4 and the primary
mail domain, fills `.env` with strong random secrets, brings the whole stack
up so TypeORM creates the schema, seeds the admin account, generates the DKIM
key and prints the DNS record to publish.

`install.sh` is a one-shot bootstrap: if `.env` already exists, it refuses to
run to avoid clobbering live secrets. To start over, remove the artifacts:

```bash
rm .env INSTALL_INFO.txt
sudo rm -rf volumes/
```

```bash
git clone <this repo> /var/docker/simply-a-dockerized-mail-server
cd /var/docker/simply-a-dockerized-mail-server
./install.sh
```

What it does, in order:

1. Prompts for `MAIL_HOSTNAME`, `MAIL_PUBLIC_IP`, `TLS_CERT_NAME` and the
   primary mail domain. Already-set values are not asked again.
2. Fills any `change_me_*` placeholder in `.env` with a random secret
   (DB, JWT and admin passwords).
3. `docker compose up -d --build` brings up every service. mariadb runs the
   `04-roundcube.sh` init script (creates `roundcube` and `opendmarc`
   databases). manager-api boots and TypeORM creates the 7 v1-compatible
   tables (`VirtualDomains`, `VirtualUsers`, `VirtualAliases`,
   `VirtualQuotaDomains`, `VirtualQuotaUsers`, `SieveRejectSenders`,
   `Accounts`) plus `RefreshTokens`, then runs the `QuotaTriggers`
   migration to install the 5 quota triggers.
4. Waits for the `Accounts` table to exist, bcrypt-hashes the admin password,
   upserts the admin row.
5. Generates the DKIM key inside the opendkim container for the primary
   domain (selector `dkim_<YYYY_MM>`), updates `key.table` and
   `signing.table`, restarts opendkim.
6. Prints the URL of each UI, the admin credentials and the DKIM TXT record
   ready to paste into your DNS provider.

Idempotent: re-running keeps existing values, only fills what is missing.

## 3. Add a domain

Sign in to the manager UI and create the domain. The DKIM key is already
loaded for the primary domain you entered in step 2. For other domains,
generate a key inline:

```bash
./service.sh exec opendkim sh -c '
  D=other-domain.com; S=dkim_$(date +%Y_%m)
  mkdir -p /etc/opendkim/keys/$D
  opendkim-genkey -b 2048 -d $D -s $S -D /etc/opendkim/keys/$D
  echo "${S}._domainkey.${D} ${D}:${S}:/etc/opendkim/keys/${D}/${S}.private" >> /etc/opendkim/key.table
  echo "*@${D} ${S}._domainkey.${D}" >> /etc/opendkim/signing.table
  cat /etc/opendkim/keys/$D/$S.txt
'
./service.sh restart opendkim
```

Publish the printed TXT record then follow [DOMAIN_DNS.md](DOMAIN_DNS.md) for
the full DNS record set (MX, SPF, DMARC).

## 4. Migrating from v1

The v2 schema is byte-for-byte identical to v1 (same column names, types,
defaults, indexes, FK CASCADE rules), so a v1 dump imports without edits.
TypeORM owns schema creation, so the right import is a `--no-create-info`
data-only dump.

On the old server:

```bash
mysqldump --no-create-info --skip-triggers mailserver \
  VirtualDomains VirtualUsers VirtualAliases \
  VirtualQuotaDomains VirtualQuotaUsers SieveRejectSenders \
  > v1-data.sql
```

On the new server, after `./install.sh` has finished:

```bash
docker compose exec -T mariadb mariadb -uroot -p"$DB_ROOT_PASSWORD" mailserver < v1-data.sql
rsync -aAX /var/mail/vhosts/  ${VOLUMES_PATH}/mail/vhosts/
```

Dovecot reads/writes the same tables, the Maildir tree keeps its `Maildir++`
layout (owner `vmail:vmail`, uid/gid 5000), and the triggers maintain the
quota aggregates as on v1.
