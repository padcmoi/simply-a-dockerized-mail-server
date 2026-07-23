# Server-wide tools

Four pages that act on the whole server rather than on one domain: the spam
filter, the mail queue, the sender blocklist and API tokens.

## Rspamd

[`/rspamd`](../../manager-ui/app/pages/rspamd.vue), requiring `rspamd:access` +
`view-rspamd-stats`. Its per-domain twin,
[`/domains/:domain/rspamd`](../../manager-ui/app/pages/domains/[domain]/rspamd.vue),
is the same page against the identical `/domains/:id/rspamd/*` endpoints,
filtered to that domain's recipients. Both share
[`useRspamdPage`](../../manager-ui/app/composables/useRspamdPage.ts), which
switches base path on whether a domain id was passed.

- **Stat tiles** and a stats card: scanned, spam, ham, greylisted, learned, plus
  uptime. When rspamd is unreachable the card says so instead of showing zeros.
- **Action thresholds** ([`RspamdActionsCard`](../../manager-ui/app/components/rspamd/RspamdActionsCard.vue)),
  server-wide only. The five scores at which soft reject, greylist, add header,
  rewrite subject and reject trigger. Editing needs
  `edit-rspamd-thresholds`; without it the card is read-only and says which
  permission is missing. Two validations run before saving: no negative
  threshold, and the order must increase (greylist < add header < rewrite
  subject < reject). **Reset to defaults** needs `reset-rspamd-thresholds` and
  confirms, naming the baseline it restores (reject 15, add header 5, greylist
  and rewrite subject disabled).
- **Bayesian statistics** -- symbol, type, learns, users, per statfile. The
  per-domain page shows this per recipient instead
  ([`RspamdDomainBayesCard`](../../manager-ui/app/components/rspamd/RspamdDomainBayesCard.vue)),
  with a note that learning happens when a message is moved into or out of the
  Junk folder.
- **Scan history** -- from, to, action, score, size, time. Paginated, searchable
  and sortable, needing `view-rspamd-history`. History lives in Redis and
  accumulates over time, which the empty state says rather than implying nothing
  is being scanned. Cards below `xl`
  ([`RspamdHistoryCard`](../../manager-ui/app/components/rspamd/RspamdHistoryCard.vue)),
  a table above it, with the action colour-coded.

## Postfix queue

[`/postfix`](../../manager-ui/app/pages/postfix.vue), requiring
`postfix:access` + `view-postfix-queue`. Reads `GET /postfix/queue` and shows
the four queue directories: active, deferred, on hold, incoming.

When the spool is not mounted the page says exactly that, because zero messages
and no visibility into the queue are not the same statement.

The same figures appear per domain on the domain dashboard, alongside the server
total.

## Sieve blocklist

[`/sieve`](../../manager-ui/app/pages/sieve.vue), requiring `sieve:access` +
`list-reject-senders`. The SQL blacklist postfix enforces at `MAIL FROM` time.

A table of sender, enabled, created and updated, paginated and sortable, with:

- **Block a sender** -- a domain (`spamdomain.com`) or a full address
  (`create-reject-sender`).
- **Enable/disable** per row, a toggle rather than a delete, so a rule can be
  parked without losing it (`edit-reject-sender`).
- **Delete** behind a confirmation (`delete-reject-sender`).

The count of blocked and enabled senders is one of the dashboard stat cards.

## API tokens

[`/api-tokens`](../../manager-ui/app/pages/api-tokens.vue), requiring
`api-tokens:access` + `list-api-tokens`. Backed by
[`useApiTokens`](../../manager-ui/app/composables/useApiTokens.ts).

A token authenticates an external tool **as you**: it carries your permissions,
not its own. Every route on this page is scoped to your own tokens; the actions
gate whether you may manage tokens at all, never whose tokens you may touch.

Tokens are sent in the `X-Api-Key` header, formatted `sms_<clientId>.<secret>`.

Per token: name, client id, allowed IPs, expiry, last used, and a status badge
(active, expired, revoked). Actions:

- **New token** (`create-api-token`) -- name, an optional comma-separated IP
  allowlist (empty means all IPs), and an optional expiry date (empty means
  none).
- **Edit** (`edit-api-token`) -- the same three fields.
- **Regenerate** (`regenerate-api-token`) -- issues a new secret for the same
  client id.
- **Revoke** (`revoke-api-token`) and **Delete permanently**
  (`delete-api-token`).

### The secret is shown once

Creation and regeneration open
[`ApiTokenRevealModal`](../../manager-ui/app/components/api-tokens/ApiTokenRevealModal.vue),
which states plainly that the key is displayed only this once and cannot be
retrieved later. It offers a copy button and an "I have saved it" button.

Dismissing that modal without saving the key **revokes and deletes the token**
rather than leaving an unusable row behind, and the toast says so: a token whose
secret nobody holds is dead weight.
