# Mail delivery pipeline

The single most important diagram in this repo: who decides where an
inbound mail ends up, in what order, and what each step can do.

## Inbound: external sender -> recipient mailbox

```
external SMTP client
        |
        | TLS handshake on public IP, port 25 (or 587 / 465 for AUTH'd)
        v
+-------------------+
| postfix smtpd     |   postscreen + smtpd_*_restrictions reject the
| port 25 / 587/465 |   obviously broken stuff (bad HELO, banned RBL,
+-------------------+   nullMX sender domain, ...). Survivors go on.
        |
        | MILTER chain (DATA accept)
        |   1. opendkim:8891  -- verifies inbound DKIM, adds Authentication-Results
        |   2. opendmarc:8893 -- evaluates DMARC alignment using the dkim result
        |   3. rspamd:11332   -- runs every rspamd module (SPF, bayes,
        |                       USER_BLOCKLIST, GLOBAL_BLOCKLIST,
        |                       RECIPIENT_RECORDER, antivirus -> ClamAV,
        |                       ...) and replies with one of:
        |                         accept | add_header | greylist | reject
        |                       `add_header` means rspamd injected
        |                       `X-Spam-Flag: YES`; `reject` is reserved
        |                       for viruses (see antivirus/).
        v
+-------------------+
| postfix LMTP      |   handoff to dovecot's LMTP on the mail bridge.
| 172.200.0.16:24   |
+-------------------+
        |
        v
+-------------------+
| dovecot LMTP -> sieve filter                          |
|                                                       |
|   step 1: sieve_before                                |
|     `/var/lib/dovecot/sieve/global/spam-to-junk.sieve`|
|     if header :contains "X-Spam-Flag" "YES" {         |
|       fileinto :create "Junk"; stop;                  |
|     }                                                 |
|     => spam ALWAYS lands in Junk, even when the user  |
|        has an AUTOROUTER rule for the same sender.    |
|                                                       |
|   step 2: user managesieve script                     |
|     `~/sieve/<active>.sieve` (typically               |
|     `roundcube.sieve`)                                |
|     - hand-crafted Roundcube filters                  |
|     - AUTOROUTER fileinto rules (see autorouter/)     |
|     last action in any matching rule is `stop;`       |
|                                                       |
|   step 3: sieve_default                               |
|     `/var/lib/dovecot/sieve/global/default.sieve`     |
|     fileinto "INBOX"; (implicit keep when nothing     |
|     matched above)                                    |
|                                                       |
|   step 4: sieve_after                                 |
|     unused (was spam-to-junk before we moved it to    |
|     sieve_before)                                     |
+-------------------+
        |
        v
+-------------------+
| Maildir on disk   |   `${VOLUMES_PATH}/mail/<domain>/<user>/(cur|new|tmp)`
+-------------------+
        |
        | LMTP delivery hook triggers the quota dict update
        v
+-------------------+
| MariaDB quota     |   VirtualQuotaUsers.bytes += size,
| triggers update   |   VirtualQuotaDomains aggregate recomputed via
| VirtualQuotaUsers |   trigger `VirtualQuotaUsers_after_insert_agg`.
+-------------------+   See quota/.
```

### Ordered checklist (the "spam check / router check / custom sieve" view)

For every inbound mail the chain answers, in this order:

1. **Is it a virus?** -- rspamd antivirus.conf -> CLAM_VIRUS, `action = reject` -> SMTP 5xx, mail never reaches anybody. The only kind of reject in the whole stack.
2. **Did rspamd decide it is spam?** -- USER_BLOCKLIST, GLOBAL_BLOCKLIST, bayes, SPF/DMARC, score >= add_header_threshold -> `X-Spam-Flag: YES` injected, no reject.
3. **Step 1 of sieve fires next (`sieve_before` = spam-to-junk)**: if the header is there, the mail moves to Junk and the sieve evaluation **stops**. No AUTOROUTER, no custom filter, no INBOX.
4. **Step 2 fires only when no spam flag**: the user's own filters run. AUTOROUTER rules and hand-crafted Roundcube filters live here.
5. **Step 3 is the catch-all**: anything that did not match earlier lands in INBOX.

That ordering is the single most important invariant of this stack: spam takes precedence over user routing, viruses take precedence over everything.

## Outbound: authenticated user -> external recipient

```
roundcube / IMAP client
        |
        | AUTH PLAIN over STARTTLS / SMTPS
        v
+--------------------------+
| postfix submission       |    Cyrus SASL talks to dovecot's `auth`
| port 587 (STARTTLS) /    |    socket -- the same Accounts as IMAP.
| port 465 (SMTPS)         |
+--------------------------+
        |
        | `smtpd_sender_login_maps` -- the AUTH user MUST match the
        | MAIL FROM domain/alias, otherwise 553. Aliases are honoured.
        |
        | MILTER chain (same three milters as inbound)
        |   1. opendkim    -- signs the outbound mail with the domain's
        |                     active selector (see dkim/)
        |   2. opendmarc   -- evaluates incoming DMARC; on the outbound
        |                     side it only enforces alignment policy.
        |   3. rspamd      -- scores outbound too (`X-Spamd-Result`
        |                     header) so a compromised account stops
        |                     blasting spam to the world.
        v
+--------------------------+
| postfix queue -> remote  |    MX lookup, TLS opportunistic, retries
| smtp                     |    on temp failures. Failure DSNs come back
+--------------------------+    via a milter-free port 10025 so the user
                                actually sees the bounce.
```

### Sieve-driven outbound side effects

- **Reject sieve** (`SieveRejectSenders` table consumed by postfix at
  `check_sender_access`): a recipient can decline a sender; postfix says
  554 before DATA is sent.
- **Vacation / reply** sieve actions go out via the same 10025 port (no
  milter loop, no infinite vacation responder).

## Local-to-local mail (user A -> user B on the same server)

Same flow as inbound, with one wrinkle: postfix-to-dovecot LMTP is one
hop. The milter chain still fires (including DKIM signing on the
outbound leg and DKIM verification on the inbound leg), so an
internally-sent mail still gets a `DKIM-Signature` and an
`Authentication-Results: dkim=pass`. Local mails are bound by the same
USER_BLOCKLIST / GLOBAL_BLOCKLIST gates as external ones.

## Special low-trust port: 10025

Defined in [`images/postfix/conf/master.cf`](../../images/postfix/conf/master.cf), this is a no-milter,
mynetworks-only sender port used by:

- sieve `reject` / `redirect` / `vacation` (DSNs to the original sender)
- the postmaster blocklist notification (`hooks/40-notify.sh`, delivered through `dovecot-lda`)

Without it dovecot-generated bounces would loop through the milter
chain, get scored as spam by rspamd, and never reach the original
sender.

## Failure modes worth knowing

| symptom                                                                              | first place to look                                                                                                              |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `dependency failed to start: container mail-dovecot is unhealthy` on a fresh install | `images/dovecot/Dockerfile` -- the dhparam must be baked, not generated at runtime. Fixed in commit `1bbc7ae`.                   |
| mail accepted but never appears in any mailbox                                       | `docker exec mail-postfix mailq` -- a stuck queue means the milter chain rejected or the LMTP handoff failed.                    |
| spam-flagged mail lands in INBOX instead of Junk                                     | `90-sieve.conf` -- `spam-to-junk.sieve` must be on `sieve_before`, not `sieve_after`.                                            |
| an inbound mail loops in defer                                                       | check `Authentication-Results` -- if DMARC=fail with reject policy, the sender domain rejects us back.                           |
| postmaster notification missing                                                      | `40-notify.sh` is the source; it now uses `dovecot-lda` so an AUTOROUTER `postmaster@<domain>` user rule routes it. See `spam/`. |

## How this flow is pinned in CI

The end-to-end suite ([`./test-mailservers.sh`](../../test-mailservers.sh)) exercises every step above. See
[test/](../test/README.md) for the per-test breakdown. Highlights:

- `delivery.smtp_to_imap` -- inbound SMTP -> IMAP read-back
- `sieve.spam_to_junk` -- `sieve_before` precedence
- `priority.sieve_before_wins` -- spam takes precedence over AUTOROUTER
- `clamav.eicar_reject` -- the virus-only reject path
- `dkim.signature_header` -- outbound DKIM signing happened
