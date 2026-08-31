# End-to-end mail-server test suite

`./test-mailservers.sh` at the project root runs an end-to-end check of
every backend mail server wired through `docker compose` -- mariadb,
redis, clamav, opendkim, opendmarc, rspamd, dovecot, postfix, roundcube
(and the supporting fail2ban / phpmyadmin). The manager-api and
manager-ui services are deliberately out of scope: they ship with their
own vitest suite.

## What it covers (63 checks)

The script (790 lines, [test-mailservers.sh](../../test-mailservers.sh)) covers:

- **infra** (12 containers + 4 healthchecks + 8 tables BDD + 5 triggers quota)
- **réseau** (5 ports -- 25/465/587/993 host + 4190 bridge)
- **auth** (SMTP 587/465, IMAPS 993, ManageSieve)
- **delivery** (SMTP -> IMAP + DKIM-Signature header + DKIM API sidecar)
- **sieve global** (default -> INBOX, spam-to-junk -> Junk)
- **sieve user** (managesieve put/get round-trip)
- **AUTOROUTER** (create / update sans duplicat / undo user folder / **4 sources système gardent la rule**: Junk/Trash/Drafts/Archive)
- **USER_BLOCKLIST** (3 marks -> spam_count=3, 4e mail SMTP -> Junk, notification postmaster via LDA, priorité `sieve_before` > AUTOROUTER)
- **GLOBAL_BLOCKLIST** (consensus 3 reporters / 4 recipients)
- **bayes** (spam_count incremented + cleared on learn_ham)
- **ClamAV** (EICAR octet-stream -> 554 `virus found: Eicar-Test-Signature`)
- **postfix** (`message_size_limit == ATTACHMENT_MAX_SIZE_MB * 1 MiB`)
- **quota** (VirtualQuotaUsers.bytes incrémenté après livraison)
- **Roundcube** (login page + lien IMAP vers dovecot)
- **dovecot-lda** (respecte AUTOROUTER user-side)
- **repo hygiene** (CHANGELOG sync)

## Fixtures

Recipients `at1..at6@<primary domain>` are created at startup (directly via
`INSERT ... ON DUPLICATE KEY UPDATE` against MariaDB so the manager-api is
not on the critical path) and removed at the end. Per-recipient cleanup
covers:

- `VirtualUsers` + `VirtualQuotaUsers` rows
- `/var/mail/vhosts/<domain>/<user>/` maildirs (inside the dovecot container)
- Redis keys that match the recipient's address (`spam_count:`, `notified:`, `BAYES_*`, etc.)

A single shared sender (`blocklist-sender@mail-tester.com`) is also wiped
between runs so blocklist tests start from zero.

## Usage

```
./test-mailservers.sh
```

at the project root. The script will:

1. `docker compose up -d --build` if the stack isn't already up
2. wait up to 180 s for every healthcheck-bearing container to report healthy
3. provision the fixtures
4. run every check, printing a colourised PASS / FAIL / SKIP line as it goes
5. tear down the fixtures
6. write a markdown report next to itself

Outputs at the project root:

- [`test-results.md`](../../test-results.md) -- structured pass/fail report with a summary table and a per-check breakdown
- `test.log` -- raw execution log (every `docker exec`, every `doveadm`, every SMTP / IMAP exchange)

Exit code: **0** if every check passes, **1** if any failed.

## Known SKIPs

| name                    | reason                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `running.mail-fail2ban` | fail2ban-server config issue (sshd-ddos jail expects `/var/log/messages` which does not exist in the Alpine container). Tracked separately, out of scope for these tests. |

## When a check fails

Each failed line shows the minimal evidence needed to start debugging:
mailbox where the message landed (or `nowhere`), the awk-extracted SMTP
response code, the head of the postfix queue, the relevant Redis counter
value, etc. The full execution log in `test.log` has every command and
response the suite issued -- grep for the failing test name to jump to its
section.
