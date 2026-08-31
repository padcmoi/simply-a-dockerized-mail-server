# Spam handling

Four collaborating mechanisms decide what the stack does with a mail
that looks like spam. They feed each other and they are documented here
in the order rspamd evaluates them.

## Goal

- **Never reject** a non-virus mail (`reject` is reserved for ClamAV).
- Tag undesirable senders with `X-Spam-Flag: YES`. The `sieve_before`
  routing then files the mail into Junk. The user can still open Junk and
  read the message -- nothing is ever lost, only re-shelved.
- Make the per-user decisions stick across both clients (Roundcube
  drag-to-Junk, mobile drag-to-Junk, doveadm save) by routing
  everything through the same `imap_sieve` triggers.

## The four mechanisms

| name                        | scope                          | source of truth                                                | TTL                             |
| --------------------------- | ------------------------------ | -------------------------------------------------------------- | ------------------------------- |
| **rspamd bayes**            | per recipient                  | Redis `RS<recipient>_<token_id>`                               | none (autolearn keeps it fresh) |
| **USER_BLOCKLIST**          | per (recipient, sender)        | Redis `spam_count:<rcpt>:<from>`                               | 180 days                        |
| **GLOBAL_BLOCKLIST**        | (sender) across all recipients | Redis `senders:<from>:reporters` + `senders:<from>:recipients` | 180 days                        |
| **postmaster notification** | per (recipient, sender)        | Redis `notified:<rcpt>:<from>` (one-shot SETNX)                | 180 days                        |

All four live in the same redis instance at
`${VOLUMES_PATH}/redis` (see [operations/](../operations/README.md)).

### 1. rspamd bayes (per-user)

Classifier-bayes config in
[`images/rspamd/conf/local.d/classifier-bayes.conf`](../../images/rspamd/conf/local.d/classifier-bayes.conf):

```
backend = "redis";
per_user = true;
users_redis_users { selector = "rcpt:addr"; }
autolearn = true;
new_schema = true;
expire = 8640000;
```

`per_user = true` plus the `rcpt:addr` selector means **each recipient
trains their own classifier**. Drag-to-Junk events on user A do not
poison user B's spam profile.

Training is driven by `imap_sieve` trigger 1 (`name = Junk, causes =
COPY APPEND`):

```
learn-spam.sieve
   -> pipe :copy "sa-learn-pipe.sh" ["spam", "${username}"];
sa-learn-pipe.sh
   -> hooks/10-bayes.sh
      -> rspamc -h $RSPAMD_HOST:$RSPAMD_PORT -d $USER learn_spam < $MESSAGE_FILE
```

Trigger 2 (`from = Junk, causes = COPY`) does the reverse with
`learn_ham`, **except** when the destination is Trash -- a delete from
Junk should not unspam.

### 2. USER_BLOCKLIST (per-user, three strikes)

Lua rule in [`images/rspamd/conf/rspamd.local.lua`](../../images/rspamd/conf/rspamd.local.lua). Fires at milter
time on every inbound mail:

```
key  = "spam_count:<rcpt>:<from>"
threshold = 3
if value at key >= threshold then
  task:set_pre_result("add header", ...)  -- forces X-Spam-Flag: YES
end
```

The counter is maintained by [`hooks/20-user-blocklist.sh`](../../images/dovecot/conf/sieve/bin/hooks/20-user-blocklist.sh):

- INBOX -> Junk move => `INCR spam_count:<rcpt>:<from>; EXPIRE 180d`
- Junk -> INBOX move => `DEL spam_count:<rcpt>:<from>`

Three drag-to-Junk events from the same sender on the same recipient
are enough to start auto-routing every subsequent mail from that sender
into that recipient's Junk -- without affecting anyone else.

#### From: parsing nuance

Both the hook and the rspamd Lua rule read the **raw** `From:` header
(`task:get_header("From")` and `awk` on the file) instead of rspamd's
canonical parser. The reason: rspamd's address parser normalises Gmail
(strips dots and `+tags`) but the user sees and acts on the **literal**
address. Without the raw lookup, drag-to-Junk on
`user.name@gmail.com` would silently fail to match
`username@gmail.com` on the next inbound mail.

### 3. GLOBAL_BLOCKLIST (Gmail-style cross-user consensus)

Same file, separate Lua rule:

```
reporters    = SCARD senders:<from>:reporters
recipients   = SCARD senders:<from>:recipients
ratio        = reporters / recipients
fire if recipients >= GLOBAL_MIN_RECIPIENTS (=4) and ratio >= GLOBAL_RATIO (=0.75)
```

Two state-keeping moving parts:

- `senders:<from>:reporters` -- SET maintained by
  [`hooks/30-global-blocklist.sh`](../../images/dovecot/conf/sieve/bin/hooks/30-global-blocklist.sh).
  - INBOX -> Junk => `SADD reporters <rcpt>; EXPIRE 180d`
  - Junk -> INBOX => `SREM reporters <rcpt>`
- `senders:<from>:recipients` -- SET maintained by the rspamd post-filter
  `RECIPIENT_RECORDER` on every accepted inbound mail. Records who has
  received mail from this sender, regardless of whether they marked it.

Once the threshold trips, `task:set_pre_result("add header", ...)` fires
for **every** recipient -- including newcomers who never interacted
with the sender. Same `add_header` action as USER_BLOCKLIST, same
`sieve_before` routing.

### 4. Postmaster notification (one-shot per threshold cross)

[`hooks/40-notify.sh`](../../images/dovecot/conf/sieve/bin/hooks/40-notify.sh):

```
if spam_count just reached threshold:
   `SETNX notified:<rcpt>:<from> 1` -> 1 means "we claimed the slot"
   if claimed:
     EXPIRE notified:<rcpt>:<from> 180d
     deliver an English explanation mail to <rcpt> via dovecot-lda
     (so the user's sieve runs on the notification too)
```

`learn_ham` (Junk -> INBOX) clears the notified flag, so a future
re-block re-arms the notification.

The mail tells the user:

- which sender is now routed to Junk,
- that nothing is ever rejected -- the message can still be opened in
  Junk,
- that emptying Trash does NOT undo the block,
- the exact unblock procedure: open Junk, pick any message from this
  sender, move it to INBOX. That single move clears the
  `spam_count` counter (via `learn_ham` + hook 20) and the next
  inbound mail lands in INBOX.

Delivery goes through `dovecot-lda` (NOT `doveadm save`) so the user's
sieve runs. A user who has an AUTOROUTER rule for
`postmaster@<their domain>` will see the notification in that folder
instead of INBOX. This is the test pinned by
`tests/10-roundcube.sh::lda.respects_user_sieve`.

## Interaction with AUTOROUTER

`sieve_before` (= `spam-to-junk.sieve`) runs BEFORE the user script.
So even when the user has an AUTOROUTER rule `<sender> -> DA`, a mail
from that sender that crosses USER_BLOCKLIST or GLOBAL_BLOCKLIST still
lands in Junk: rspamd injects `X-Spam-Flag: YES`, spam-to-junk fires
`fileinto Junk; stop;`, the user script never runs.

The test `priority.sieve_before_wins` pins this invariant.

## Where each hook runs

The four hooks under
[`images/dovecot/conf/sieve/bin/hooks/`](../../images/dovecot/conf/sieve/bin/hooks/) are run in
lexical order by `sa-learn-pipe.sh`:

```
10-bayes.sh             train rspamd's per-user bayes classifier
20-user-blocklist.sh    INCR/DEL spam_count:<rcpt>:<from>
30-global-blocklist.sh  SADD/SREM senders:<from>:reporters
40-notify.sh            postmaster mail at threshold cross
```

Adding a new concern is dropping a `NN-name.sh`; removing one is
`rm`-ing the file. Each hook is a self-contained POSIX shell script
that gets `($action, $user, $from, $message_file)` and exits 0 even on
failure (the orchestrator wraps with `|| true` so one broken hook does
not break the chain).

## How to debug

- `docker exec mail-redis redis-cli GET "spam_count:<rcpt>:<from>"` --
  the per-user counter.
- `docker exec mail-redis redis-cli SMEMBERS "senders:<from>:reporters"`
  -- who has marked this sender.
- `docker exec mail-redis redis-cli SMEMBERS "senders:<from>:recipients"`
  -- who has ever received from this sender.
- `docker exec mail-redis redis-cli GET "notified:<rcpt>:<from>"` -- 1
  means the postmaster mail was sent and is still on cooldown.
- `docker exec mail-rspamd rspamc -d <rcpt> stat` -- per-user bayes
  totals.
- `docker exec mail-dovecot tail -f /var/log/mail/dovecot.log` -- look
  for `sieve:` + `pipe:` entries when a move fires.

## How it is tested

[tests/06-blocklist.sh](../../tests/06-blocklist.sh):

- `blocklist.spam_count` -- three INBOX->Junk moves -> counter = 3
- `blocklist.fourth_mail_to_junk` -- inbound from the blocklisted
  sender -> Junk
- `blocklist.postmaster_notification` -- the explanation mail arrives
- `priority.sieve_before_wins` -- the precedence invariant
- `global_blocklist.counts` -- 3 of 4 recipients marked as spam -> the
  `reporters` set has 3 members and `recipients` has 4

[tests/07-hooks.sh](../../tests/07-hooks.sh) pins the bayes side:

- `hook.10_bayes.per_user_tokens` -- per-user `RS<email>_*` keys appear
  in Redis after the first learn_spam
- `bayes.spam_count_incremented` / `bayes.learn_ham_clears_counter` --
  the INCR/DEL contract of hook 20
