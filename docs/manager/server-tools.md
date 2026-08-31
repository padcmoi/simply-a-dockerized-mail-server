# Server-wide tools

Five pages that act on the whole server rather than on one domain: the spam
filter, the mail queue, the sender blocklist, API tokens, and the machine the
whole stack runs on.

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

## Supervision

[`/admin/supervision`](../../manager-ui/app/pages/admin/supervision.vue),
requiring `supervision:access` + `view-machine-metrics`. The state of the host
itself: CPU, load average, memory and network. Four cards, one per measurement,
because they are four different readings and a card each is what lets them wrap
on a narrow screen instead of being squeezed into a strip.

- **One window for the four curves** (`1 min`, `1 h`, `24 h`, `7 days`), set
  from any card's header and applied to all of them. Four charts covering four
  different periods cannot be read against each other, which is most of what a
  row of them is for. The figures on the header lines stay live whatever the
  curves are set to: what the machine is doing now is a fact about now.
- **The minute comes from the socket**, one frame a second
  (`supervision-machine`, see [realtime.md](realtime.md)); the three wider
  windows come from recorded samples aggregated in SQL, one row per ten seconds.
- **A missing figure is never drawn as a zero.** A CPU that has had only one
  reading of `/proc/stat`, a host whose own interfaces are out of reach from the
  container, and a stretch nothing was recorded in are three different holes:
  the curve is cut, the point keeps its place on the time axis, and each case
  has its own sentence rather than a dash that could mean any of them.
- **The live minute never stops moving.** A curve redrawn in place jumps a step
  a second, which reads as a stutter; instead the plot is laid out one step wider
  than its box, with the newest sample just past the right edge, and walked left
  by that step over the sampling interval, graduation included, so a mark and the
  moment it names travel together. The walk freezes while the pointer is on the
  plot, since reading a figure is not watching a curve, and does not happen at
  all for an account asking for reduced motion or on the recorded windows.
- **The axis carries clock times in the reader's own zone**, on round moments of
  their own day, so a peak lines up against a deploy or a backup instead of
  asking them to subtract. Pointing at the plot reads every curve at that moment.
- **Raised is named, not just coloured.** Past 70 % of the cores (load) or of
  what is installed (memory) the card gains an outline **and** a badge saying
  what happened, error past 90 %.

Two things it does not do. It never claims to be live on a socket that stopped
delivering: eight seconds without a frame flips the badge to Offline, while the
last figures stay on screen, dimmed, because they are still the truth of a
moment ago. And it reports **nothing at all** for the network when the host's
own `/proc` is not mounted into `manager-api`, rather than reporting the
container's veth as if it were the machine's interface.

How long the recorded history is kept is a root-only setting, documented in
[configuration.md](configuration.md).
