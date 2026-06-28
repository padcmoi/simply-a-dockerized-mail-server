# Quota tracking

Per-user and per-domain quota counters live in MariaDB, are updated by
**triggers** on every relevant write, and are read by both dovecot
(quota enforcement at IMAP / LMTP time) and the manager-api (admin
dashboard).

## Schema (v1-compatible)

```
VirtualUsers (id, email, quota, ...)            -- limit in bytes
VirtualQuotaUsers (id, email, bytes, messages,  -- live counters
                   last_activity ON UPDATE CURRENT_TIMESTAMP)
VirtualDomains (id, domain, quota, ...)         -- domain-wide limit
VirtualQuotaDomains (id, domain, bytes, messages, last_activity)
```

`VirtualQuotaUsers.email` and `VirtualQuotaDomains.domain` are foreign
keys with `ON DELETE CASCADE ON UPDATE CASCADE` -- removing a user wipes
their quota row too.

## The five triggers

Installed at boot by manager-api's
[`OnApplicationBootstrap`](../../manager-api/src/common/quota-triggers.bootstrap.ts),
not by SQL init scripts (so they survive a `truncate` + reseed).

| trigger                              | when                       | does                                                                                                                                |
| ------------------------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `VirtualUsers_after_insert_quota`    | `INSERT VirtualUsers`      | `INSERT IGNORE INTO VirtualQuotaUsers` -- a brand new mailbox starts with a zero counter.                                           |
| `VirtualDomains_after_insert_quota`  | `INSERT VirtualDomains`    | same for `VirtualQuotaDomains`.                                                                                                     |
| `VirtualQuotaUsers_after_insert_agg` | `INSERT VirtualQuotaUsers` | recompute `VirtualQuotaDomains.bytes` and `messages` for the parent domain from `SUM(VirtualQuotaUsers WHERE domain = NEW.domain)`. |
| `VirtualQuotaUsers_after_update_agg` | `UPDATE VirtualQuotaUsers` | same recompute -- fires on every LMTP delivery and every IMAP expunge.                                                              |
| `VirtualQuotaUsers_after_delete_agg` | `DELETE VirtualQuotaUsers` | same recompute -- fires when a user is removed.                                                                                     |

The per-user counter is the source of truth; the per-domain counter is
always a `SUM` of its members. No drift.

## Wire-up to dovecot

[`90-quota.conf`](../../images/dovecot/conf/conf.d/90-quota.conf) enables
the `quota` plugin with a `dict_sql` backend pointing at MariaDB:

```
plugin {
  quota = dict:User quota::proxy::quota
}
dict {
  quota = mysql:/etc/dovecot/dovecot-dict-sql.conf.ext
}
```

[`dovecot-dict-sql.conf.ext`](../../images/dovecot/conf/dovecot-dict-sql.conf.ext)
maps the dict keys to UPDATE statements on `VirtualQuotaUsers`. Every
LMTP delivery and every IMAP EXPUNGE updates the row, the triggers
keep the domain aggregate in sync.

## Wire-up to postfix (over-quota rejection)

The `quota-status` daemon shipped with dovecot answers
`postfix recipient_restrictions` via the
`check_policy_service inet:mail-dovecot:12340` line in
[`main.cf`](../../images/postfix/conf/main.cf). When a recipient is over
quota, postfix replies `552 5.2.2 Mailbox is full` at RCPT TO time --
no queue, no NDR to bounce back later.

## How to inspect

```
docker exec mail-mariadb mariadb -uroot -p"$DB_ROOT_PASSWORD" -BN mailserver \
  -e "SELECT email, bytes, messages, last_activity FROM VirtualQuotaUsers"
```

or with dovecot's own view:

```
docker exec mail-dovecot doveadm quota get -u user@domain.tld
```

## How it is tested

[tests/09-postfix-limits.sh](../../tests/09-postfix-limits.sh):

- `quota.bytes_increased` -- inject a 1 KiB mail via `doveadm save` and
  assert the per-user `bytes` counter went up.
- `attachments.message_size_limit` -- pin the postfix
  `message_size_limit` value against `ATTACHMENT_MAX_SIZE_MB * 1 MiB`.

## Caveats

- The triggers run inside the same transaction as the write that fires
  them. A misconfigured `sql_mode` can silently turn them into no-ops --
  the bootstrap script sets the right modes.
- The aggregate `VirtualQuotaDomains.bytes` is recomputed by `SUM` on
  every per-user write. For 100k users this would be expensive; the
  current `VirtualUsers.domain` key makes the SUM acceptable up to a
  few thousand mailboxes per domain. Above that, a materialised
  per-domain counter with `INCR`/`DECR` would scale better.
- Manual `UPDATE VirtualQuotaUsers SET bytes = 0` is allowed (resets
  the counter without touching the maildir). The next delivery
  recomputes from there.
