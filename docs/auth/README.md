# Authentication

One MariaDB-backed identity store, three protocols (SMTP submission,
IMAP, ManageSieve), and a strict sender-login binding that prevents a
compromised user from spoofing peers.

## Tables involved

- **`Accounts`** -- the admin / staff users that log in to
  manager-ui (`bcrypt` password). Not mailboxes.
- **`VirtualUsers`** -- the actual mailboxes. `password` is
  `{SHA512-CRYPT}` (matches v1 production for zero-cost migration).
- **`VirtualDomains`** -- the domain each mailbox lives in.
- **`VirtualAliases`** -- forwarding-only addresses; resolve to a
  VirtualUsers email.
- **`RefreshTokens`** -- manager-api JWT refresh tokens. Out of scope
  for the mail backends.

`VirtualUsers.password` example:

```
{SHA512-CRYPT}$6$Bnn9dijW5P18fW9Q$Jht2eHhumKsmGxqzIsANa.9shi/Stk0UzwTYh4vXFBH3FJSBsuixoS59ST4zLgmuDoDqq6sjTbxnJN7i9uQxh1
```

Hashed by the manager-api via `openssl passwd -6` (= SHA512-CRYPT) at
write time. Dovecot's `auth_default_realm` + `dovecot-sql.conf.ext`
binds this column to the auth lookup.

## The Cyrus SASL passthrough

Postfix does not talk to MariaDB directly for SASL. It exposes the
dovecot `auth` UNIX socket through `smtpd_sasl_path = inet:dovecot:12345`
in [`main.cf`](../../images/postfix/conf/main.cf), so a SASL AUTH PLAIN
on port 587 / 465 is the **same lookup** as an IMAP LOGIN on port 993.

Why it matters:

- A single password change in `VirtualUsers.password` updates SMTP, IMAP
  and ManageSieve at once.
- Brute-force protection (Dovecot's `auth_failure_delay` +
  `auth_anonymous_username`) covers SMTP submission too.

## sender_login_maps

[`main.cf`](../../images/postfix/conf/main.cf):

```
smtpd_sender_restrictions =
  permit_mynetworks,
  permit_sasl_authenticated,
  reject_sender_login_mismatch,
  reject_unverified_sender
smtpd_sender_login_maps = mysql:/etc/postfix/sql/sender_login_maps.cf
```

The SQL view returns every (alias_or_real_address, owner_email) pair so
postfix can verify that an AUTH'd user only sends as their own address
or one of their aliases. `MAIL FROM:<charlie@example.com>` while AUTH'd
as `alice@example.com` -> `553 5.7.1 Sender address rejected:
not owned by user alice@example.com`.

## Ports and protocols

| port  | service              | binding     | what runs                                                                                                |
| ----- | -------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| 25    | postfix smtpd        | host        | inbound SMTP from anywhere. Milter chain active. AUTH disabled.                                          |
| 465   | postfix smtps        | host        | submission over implicit TLS. AUTH required.                                                             |
| 587   | postfix submission   | host        | submission over STARTTLS. AUTH required.                                                                 |
| 993   | dovecot imaps        | host        | IMAP over TLS.                                                                                           |
| 4190  | dovecot managesieve  | bridge only | sieve script management. Reachable from `mail-roundcube` and other bridge containers, not from the host. |
| 10025 | postfix internal     | bridge only | milter-free relay for sieve DSNs and the postmaster notification. mynetworks only.                       |
| 12340 | dovecot quota-status | bridge only | postfix policy lookup -- see [quota/](../quota/README.md).                                               |
| 12345 | dovecot auth socket  | bridge only | what postfix SASL talks to.                                                                              |

## Manager-api authentication

Out of scope for the mail backends, but worth noting:

- `Accounts` rows authenticate against `manager-api` via username +
  bcrypt.
- A successful login returns a short-lived JWT + a refresh token (in
  `RefreshTokens`).
- The refresh token rotates on every use to limit blast radius if the
  client is compromised.

The mail stack does **not** consume manager-api auth -- a dead
manager-api leaves mail working. Manager-api can be rebooted without
disconnecting any user.

## Password rotation playbook

Via manager-api (recommended):

```
PATCH /api/users/:id { "password": "newpass" }
```

The api hashes with `openssl passwd -6`, UPDATEs `VirtualUsers.password`.
Dovecot's auth cache is short-lived (`auth_cache_ttl = 1 hour` by
default, drops to 0 on a `doveadm reload`). For an immediate effect:

```
docker exec mail-dovecot doveadm reload
```

Manually in the DB (emergency only):

```sql
UPDATE VirtualUsers
SET password = CONCAT('{SHA512-CRYPT}', SUBSTRING_INDEX('${HASH}', '{SHA512-CRYPT}', -1))
WHERE email = 'user@example.com';
```

where `${HASH}` is the output of `openssl passwd -6 -salt rngsalt newpass`.

## Brute-force protection

Two layers:

- **fail2ban** -- watches the dovecot + postfix logs and bans an IP
  after `maxretry` (default 6) auth failures in `findtime` (default 10
  min). Bans for `bantime` (default 1 hour). Configured in
  [`images/fail2ban/`](../../images/fail2ban/) -- known issue: the
  shipped `sshd-ddos` jail expects `/var/log/messages` which does not
  exist in our Alpine container, causing fail2ban to restart-loop on a
  freshly built image. Tracked separately; documented as a SKIP in
  [test/](../test/README.md).
- **dovecot built-in** -- `auth_failure_delay = 2s` slows down a
  brute-force attacker even before fail2ban kicks in. Set in
  [`90-master.conf`](../../images/dovecot/conf/conf.d/90-master.conf).

## How it is tested

[`tests/02-auth.sh`](../../tests/02-auth.sh):

- `smtp.auth.587` -- AUTH PLAIN over STARTTLS works.
- `smtp.auth.465` -- AUTH PLAIN over implicit TLS works.
- `imap.login.993` -- IMAP LOGIN works.
- `managesieve.banner` -- the managesieve service is reachable on
  port 4190 from inside the bridge.

[`tests/03-delivery.sh`](../../tests/03-delivery.sh) implicitly covers
`sender_login_maps`: the test sends as `at1@<domain>` while AUTH'd as
`at1@<domain>`. A misconfigured `sender_login_maps` would 553 here.
