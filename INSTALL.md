# Installation guide

## 1. Prerequisites

| Requirement             | Notes |
| ----------------------- | ----- |
| Docker Engine 24+       | with the `docker compose` plugin |
| Public IPv4             | with PTR pointing to `<MAIL_HOSTNAME>` |
| Open inbound ports      | 25, 465, 587, 993 |
| TLS certificate         | `/etc/letsencrypt/live/<MAIL_HOSTNAME>/{fullchain,privkey}.pem` |
| Host nginx (optional)   | for reverse-proxying the manager UI / roundcube to loopback ports |

## 2. Configure

```bash
git clone <this repo> /var/docker/simply-a-dockerized-mail-server
cd /var/docker/simply-a-dockerized-mail-server
cp .env.sample .env
$EDITOR .env
```

Must set:

| Variable                | Example              |
| ----------------------- | -------------------- |
| `MAIL_HOSTNAME`         | `mail.example.com`   |
| `MAIL_PUBLIC_IP`        | `203.0.113.10`       |
| `TLS_CERT_NAME`         | `mail.example.com`   |
| `TLS_LETSENCRYPT_PATH`  | `/etc/letsencrypt`   |

## 3. Bootstrap

```bash
./install.sh
```

Fills any `change_me_*` placeholder with a fresh random secret, brings only
`mariadb` up, runs the schema and trigger SQL, hashes
`MANAGER_ADMIN_PASSWORD` with bcrypt and inserts the admin row in
`Accounts`. Idempotent.

## 4. Start

```bash
./service.sh up
./service.sh ps
./service.sh logs postfix
```

## 5. Add a domain

In the manager UI, sign in and create the domain. Then generate the DKIM key:

```bash
./service.sh exec opendkim sh -c '
  D=example.com; S=dkim_$(date +%Y_%m)
  mkdir -p /etc/opendkim/keys/$D
  opendkim-genkey -b 2048 -d $D -s $S -D /etc/opendkim/keys/$D
  echo "${S}._domainkey.${D} ${D}:${S}:/etc/opendkim/keys/${D}/${S}.private" >> /etc/opendkim/key.table
  echo "*@${D} ${S}._domainkey.${D}" >> /etc/opendkim/signing.table
  cat /etc/opendkim/keys/$D/$S.txt
'
./service.sh restart opendkim
```

Publish the printed TXT record then follow [DOMAIN_DNS.md](DOMAIN_DNS.md).

## 6. Migrating from v1

```bash
./service.sh down
docker compose up -d mariadb
docker compose exec -T mariadb mariadb -uroot -p"$DB_ROOT_PASSWORD" mailserver < v1-dump.sql
rsync -aAX /var/mail/vhosts/  ${VOLUMES_PATH}/mail/vhosts/
./service.sh up
```

The schema matches v1 byte-for-byte, dovecot reads/writes the same tables, and
the Maildir tree is the same layout (`Maildir++`, owner `vmail:vmail`).
