# Simply Mail Server v2

Multi-container, MySQL-driven, multi-domain mail server packaged with Docker.
**Every persistent state lives in MariaDB** (domains, mailboxes, aliases,
quotas, sieve filters, admin auth) so the existing v1 production dump imports
1:1 and dovecot keeps the `VirtualQuotaUsers` / `VirtualQuotaDomains` rows
updated on every delivery via dict-sql.

## Stack

| Container          | Image base          | Role                                                                                                                                                   |
| ------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mail-mariadb`     | mariadb:11.4        | Single source of truth (mailserver + opendmarc + roundcube DBs)                                                                                        |
| `mail-redis`       | redis:7.4-alpine    | Rspamd backend (bayes, cache)                                                                                                                          |
| `mail-unbound`     | alpine:3.20         | Recursive DNS resolver for rspamd, postfix, opendmarc and manager-api: blocklists and DKIM checks answer as they should, whatever the host resolver is |
| `mail-postfix`     | alpine:3.20         | SMTP 25/465/587, MySQL maps, milter chain, LMTP delivery                                                                                               |
| `mail-dovecot`     | alpine:3.20         | IMAPS 993, LMTP 24, SASL 12345, ManageSieve 4190, dict-sql quota                                                                                       |
| `mail-rspamd`      | alpine:3.20         | Anti-spam milter (port 11332) + web UI (11334)                                                                                                         |
| `mail-opendkim`    | alpine:3.20         | DKIM signing milter (8891)                                                                                                                             |
| `mail-opendmarc`   | alpine:3.20         | DMARC validation milter (8893)                                                                                                                         |
| `mail-clamav`      | alpine:3.20         | Optional anti-virus (compose profile `antivirus`)                                                                                                      |
| `mail-fail2ban`    | alpine:3.20         | Bans on auth / RBL hits, host network                                                                                                                  |
| `mail-roundcube`   | roundcube:1.6.10    | Webmail                                                                                                                                                |
| `mail-manager-api` | NestJS 11           | REST CRUD (domains/users/aliases/quotas/sieve) + JWT auth                                                                                              |
| `mail-manager-ui`  | Nuxt 3 + Nuxt UI v4 | Admin SPA, Nitro proxies `/api` to manager-api                                                                                                         |

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
$EDITOR .env              # set MAIL_HOSTNAME, MAIL_PUBLIC_IP, TLS_CERT_NAME, MANAGER_APP_NAME
./install.sh              # generates secrets, seeds admin account
./service.sh up           # build + start full stack
```

See [INSTALL.md](INSTALL.md) for a full step-by-step and [DOMAIN_DNS.md](DOMAIN_DNS.md)
for the DNS records per hosted domain.

## Updating

```bash
./update.sh full     # every image rebuilt, every container recreated
./update.sh ui api   # only the manager, when the release notes say so
```

`update.sh` runs `git pull` on the branch the server is on, then rebuilds. It is
the only way a server receives the fixes and the features of this repository.

> [!IMPORTANT]
> **A server whose code was modified no longer receives the updates of this
> repository.** Git refuses to pull over a file changed by hand that the
> update changes too, and `update.sh` stops there, leaving the server on its
> old version. Where the pull does go through, the server builds the update
> mixed with the local change, a combination nobody has tested, which the next
> update can break.
>
> What is meant to change on a server lives outside the code, and no update
> touches it: `.env`, the volumes folder (mailboxes, database, backups, your
> own icon, logo and favicon) and the settings of the manager. On a server
> whose code is as this repository ships it, `git status --short` prints
> nothing.
>
> A change that would be useful to others belongs here: propose it as
> described in [CONTRIBUTING.md](CONTRIBUTING.md). Once merged, every server
> gets it with its next update.

## Contributing

Simply Mail Server is an open project, built to become a complete mail platform
that anyone can install and run. Contributions are welcome: a fix, a feature, a
translation, documentation, a test or a bug report. Start with
[CONTRIBUTING.md](CONTRIBUTING.md), and open an issue or a pull request on
[GitHub](https://github.com/padcmoi/simply-a-dockerized-mail-server).

## License

[MIT](LICENSE.md)
