# Simply Mail Server v2

Multi-container, MySQL-driven, multi-domain mail server packaged with Docker.
**Every persistent state lives in MariaDB** (domains, mailboxes, aliases,
quotas, sieve filters, admin auth) so the existing v1 production dump imports
1:1 and dovecot keeps the `VirtualQuotaUsers` / `VirtualQuotaDomains` rows
updated on every delivery via dict-sql.

## Stack

| Container         | Image base       | Role |
| ----------------- | ---------------- | ---- |
| `mail-mariadb`    | mariadb:11.4     | Single source of truth (mailserver + opendmarc + roundcube DBs) |
| `mail-redis`      | redis:7.4-alpine | Rspamd backend (bayes, cache) |
| `mail-postfix`    | alpine:3.20      | SMTP 25/465/587, MySQL maps, milter chain, LMTP delivery |
| `mail-dovecot`    | alpine:3.20      | IMAPS 993, LMTP 24, SASL 12345, ManageSieve 4190, dict-sql quota |
| `mail-rspamd`     | alpine:3.20      | Anti-spam milter (port 11332) + web UI (11334) |
| `mail-opendkim`   | alpine:3.20      | DKIM signing milter (8891) |
| `mail-opendmarc`  | alpine:3.20      | DMARC validation milter (8893) |
| `mail-clamav`     | alpine:3.20      | Optional anti-virus (compose profile `antivirus`) |
| `mail-fail2ban`   | alpine:3.20      | Bans on auth / RBL hits, host network |
| `mail-roundcube`  | roundcube:1.6.10 | Webmail |
| `mail-manager-api`| NestJS 11        | REST CRUD (domains/users/aliases/quotas/sieve) + JWT auth |
| `mail-manager-ui` | Nuxt 3 + Nuxt UI v4 | Admin SPA, Nitro proxies `/api` to manager-api |

## Database compatibility contract

The 7 production tables ship with their v1 shape exactly (`utf8_general_ci`,
InnoDB, FK CASCADE intact, `last_activity ON UPDATE current_timestamp()`).
Additive only:

- `Accounts` gains `password / role / enabled / last_login / created_at /
  updated_at` (all nullable or with safe defaults; legacy 2-column dump still
  imports).
- A new `RefreshTokens` table holds JWT refresh sessions.

## Quota write path

```
external MTA  -->  postfix smtpd
                       |  (mysql VirtualUsers, VirtualAliases, SieveRejectSenders,
                       |   quota policy via dovecot:12340)
                       v
                  LMTP dovecot:24
                       |
                       v
   /var/mail/vhosts/<domain>/<user>/new/<id>      <-- file written by vmail
                       |
                       v
  UPDATE VirtualQuotaUsers SET bytes=..., messages=...   <-- dovecot dict-sql
                       |
                       v
  trigger -> UPDATE VirtualQuotaDomains aggregate         <-- MariaDB trigger
```

## Quick start

```bash
cp .env.sample .env
$EDITOR .env              # set MAIL_HOSTNAME, MAIL_PUBLIC_IP, TLS_CERT_NAME
./install.sh              # generates secrets, seeds admin account
./service.sh up           # build + start full stack
```

See [INSTALL.md](INSTALL.md) for a full step-by-step and [DOMAIN_DNS.md](DOMAIN_DNS.md)
for the DNS records per hosted domain.

## License

[MIT](LICENSE.md)
