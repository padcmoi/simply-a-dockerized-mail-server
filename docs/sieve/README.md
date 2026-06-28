# Sieve mechanics

Two sieve worlds live on this dovecot:

1. **Delivery-time sieve** (LMTP path) -- runs once when a new mail
   arrives in the Maildir. Decides which mailbox the mail lands in.
2. **IMAP-event sieve** (`imap_sieve` plugin) -- runs on every IMAP
   COPY/APPEND/FLAG, after the user (or their client) acted. Used for
   bayes training, spam_count book-keeping, and AUTOROUTER upsert/undo.

The two interact via the user's managesieve script: the IMAP-event sieve
EDITS that script, the next delivery RUNS it.

## Where things live

| concern                          | file                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Delivery script wiring           | [`images/dovecot/conf/conf.d/90-sieve.conf`](../../images/dovecot/conf/conf.d/90-sieve.conf)                                                                                                           |
| Spam routing (sieve_before)      | [`images/dovecot/conf/sieve/spam-to-junk.sieve`](../../images/dovecot/conf/sieve/spam-to-junk.sieve)                                                                                                   |
| Default fallback (sieve_default) | `default.sieve` (fileinto INBOX) -- created by the entrypoint                                                                                                                                          |
| User active script               | `~/sieve/<active>.sieve` -- typically `roundcube.sieve`, written by Roundcube's managesieve plugin or by our `auto-route` hooks                                                                        |
| Trigger 1: Junk learn-spam       | [`images/dovecot/conf/sieve/learn-spam.sieve`](../../images/dovecot/conf/sieve/learn-spam.sieve) -> [`sa-learn-pipe.sh`](../../images/dovecot/conf/sieve/bin/sa-learn-pipe.sh)                         |
| Trigger 2: ham (back from Junk)  | [`images/dovecot/conf/sieve/learn-ham.sieve`](../../images/dovecot/conf/sieve/learn-ham.sieve)                                                                                                         |
| Trigger 3: AUTOROUTER create     | [`images/dovecot/conf/sieve/auto-route.sieve`](../../images/dovecot/conf/sieve/auto-route.sieve) -> [`auto-route-pipe.sh`](../../images/dovecot/conf/sieve/bin/auto-route-pipe.sh)                     |
| Trigger 4: AUTOROUTER undo       | [`images/dovecot/conf/sieve/auto-route-undo.sieve`](../../images/dovecot/conf/sieve/auto-route-undo.sieve) -> [`auto-route-undo-pipe.sh`](../../images/dovecot/conf/sieve/bin/auto-route-undo-pipe.sh) |

## Delivery-time execution order

```
LMTP delivery
   |
   v
sieve_before  -> spam-to-junk.sieve
   |             X-Spam-Flag: YES ?
   |               yes -> fileinto Junk; stop;
   |               no  -> fallthrough
   v
sieve script  -> ~/sieve/<active>.sieve
   |             (Roundcube filters + AUTOROUTER rules)
   |             matching rule: fileinto "<folder>"; stop;
   |             no match: implicit fallthrough
   v
sieve_default -> default.sieve
   |             fileinto INBOX
   v
sieve_after   -> (empty; we moved spam-to-junk to sieve_before)
```

Wired in `90-sieve.conf`:

```
sieve         = file:~/sieve;active=~/.dovecot.sieve
sieve_default = /var/lib/dovecot/sieve/global/default.sieve
sieve_before  = /var/lib/dovecot/sieve/global/spam-to-junk.sieve
```

### Why `sieve_before` and not `sieve_after`?

Every AUTOROUTER rule ends with `stop;`. Used to be configured on
`sieve_after`, so a spam-flagged mail from a sender the user had already
auto-routed would short-circuit the spam routing and land in the
auto-route folder. With `sieve_before` the X-Spam-Flag check runs **first**
and `stop;`s before the user script even gets a chance. See commit
`03e8efc` for the rationale.

## IMAP-event triggers (imap_sieve)

The `imap_sieve` plugin watches every IMAP COPY/APPEND/FLAG and matches
each event against the `imapsieve_mailbox<N>` blocks declared in
`90-sieve.conf`. Every matching block fires (not just the first).

```
imapsieve_mailbox1  name=Junk   from=*       causes=COPY APPEND -> learn-spam.sieve
imapsieve_mailbox2  name=*      from=Junk    causes=COPY        -> learn-ham.sieve
imapsieve_mailbox3  name=*      from=INBOX   causes=COPY        -> auto-route.sieve
imapsieve_mailbox4  name=INBOX  from=*       causes=COPY        -> auto-route-undo.sieve
```

The script pipes the message to a per-trigger orchestrator
(`sa-learn-pipe.sh` for triggers 1/2, `auto-route-pipe.sh` for 3,
`auto-route-undo-pipe.sh` for 4). Each orchestrator parses the message
once and delegates to per-concern hooks under `hooks/`,
`auto-route-hooks/`, `auto-route-undo-hooks/` respectively. See
[spam/](../spam/README.md) and [autorouter/](../autorouter/README.md)
for the per-hook contracts.

### IMAP cause cheatsheet

| cause  | when                                                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| COPY   | the standard one. Catches IMAP COPY+EXPUNGE clients **and** modern MOVE clients (dovecot implements MOVE as COPY+EXPUNGE internally, the COPY trigger fires either way).  |
| APPEND | the client uploaded a new message into a mailbox (Drafts save, push of a forwarded mail to Sent...). Used for trigger 1 so saving a Sent copy into Junk also trains spam. |
| FLAG   | flag change only (\\Seen, \\Flagged, ...). Currently unused but left wired in `sieve_global_extensions`.                                                                  |

### Mailbox-name gotchas

- Dovecot is **case-insensitive on `INBOX`** (RFC) and **case-sensitive on
  everything else**. The trigger configs use the canonical names; user
  folders just keep their literal name.
- Source filtering (`_from = INBOX`) is a strict source pin. To exclude
  system folder _destinations_, the filtering happens **inside** the
  sieve script via `environment :matches "imap.mailbox"` -- see
  `auto-route.sieve`.
- Pigeonhole 0.5 does **not** expose the source mailbox to the sieve
  script (`imap.mailbox` = destination). That is why the undo flow has
  to recover the source via `doveadm fetch mailbox '*' header
Message-ID` -- see [autorouter/](../autorouter/README.md).

## ManageSieve

- TCP 4190 inside the docker bridge only -- not exposed on the host.
- Auth via the same Cyrus SASL passthrough as IMAP.
- Roundcube's `managesieve` plugin reads/writes the user's active script
  through this protocol.
- The AUTOROUTER hooks edit the same `roundcube.sieve` file Roundcube
  manages; both writers use compatible CRLF + `# rule:[<name>]`
  formatting so a rule written by either side parses cleanly on the
  other.

## How to add a new global sieve script

1. Drop it under [`images/dovecot/conf/sieve/`](../../images/dovecot/conf/sieve/) on the build context.
2. Add a `sieve_before` / `sieve_after` entry, or a new
   `imapsieve_mailbox<N>` block, in
   [`90-sieve.conf`](../../images/dovecot/conf/conf.d/90-sieve.conf).
3. Rebuild dovecot: `docker compose build dovecot && docker compose up -d dovecot`.
4. The entrypoint copies every `.sieve` from `/etc/dovecot/sieve/` to
   `/var/lib/dovecot/sieve/global/` and recompiles via `sievec`. If the
   script has a syntax error, dovecot will log it and refuse to use it;
   delivery falls back to `sieve_default`.

## How to debug a misrouted mail

1. `docker exec mail-dovecot tail -f /var/log/mail/dovecot.log` -- look
   for `sieve:` lines, they tell you exactly which action fired (`store
to Junk`, `fileinto`, `stop`...).
2. Check the message itself for `X-Spam-Flag: YES`. If present, the
   `sieve_before` step routed it. If absent, the user's script did.
3. `docker exec mail-dovecot cat /var/mail/vhosts/<domain>/<user>/sieve/roundcube.sieve`
   to see exactly which rules the user has. AUTOROUTER markers begin
   with `# rule:[AUTOROUTER `.
4. Force a re-delivery with `doveadm-lda -d <user> -f <sender> <
/path/to/eml` and watch the log.
