# The realtime layer

One WebSocket per browser tab carries everything that has to stay live: figures
that would go stale, presence, typing, read receipts and the notification bell.
Nothing depends on it exclusively. Every screen it feeds also has a REST path,
so the console degrades to polling rather than breaking when the socket is down.

The browser connects to `/realtime` on its own origin;
[`server/routes/realtime.ts`](../../manager-ui/server/routes/realtime.ts)
proxies it to `NUXT_REALTIME_TARGET`.

## Client side

[`plugins/realtime.client.ts`](../../manager-ui/app/plugins/realtime.client.ts)
owns the single socket.

- It connects when the auth store becomes authenticated and disconnects on
  logout.
- **It refreshes the token before connecting.** The stored access token may well
  have expired while the socket was down, and the gateway closes on a stale one:
  reconnecting without rotating first would just loop until the user reloaded
  the page by hand.
- **Reconnection backs off** from 1 second to a 30 second ceiling, and resets on
  a successful open.
- **A ping every 25 seconds, with a 60 second silence limit.** A socket can die
  without a close event (a suspended tab, a NAT dropping the mapping) and then
  deliver nothing while still claiming to be open. Pinging turns that silence
  into a fact.
- **Coming back to the tab reconnects immediately** rather than waiting out the
  backoff, on `focus`, on `visibilitychange` and on the browser's `online`
  event. That is exactly when a dead connection gets noticed.
- On every (re)connection it re-authenticates, re-subscribes to the currently
  active topics, and fires the open handlers so anything stateful re-announces
  itself.

[`useRealtime.ts`](../../manager-ui/app/composables/useRealtime.ts) is the API
the rest of the app sees:

```ts
const summary = useRealtimeTopic<DashboardSummary>("dashboard");
const thread  = useRealtimeTopic<TicketDetail>(() => ticketId.value ? `ticket:${ticketId.value}` : null);
```

Subscriptions are reference-counted per topic: the plugin subscribes when the
first consumer appears and unsubscribes when the last one goes away. A topic
expressed as a getter follows its resolved value, re-subscribing when it changes
and holding nothing while it is null, which is what parameterized topics whose
id resolves asynchronously need.

`realtimeSend(event, data)` is the one door for client-to-server signals
(`typing`, `activity`). It is best effort by design: no socket, no signal.

## Topics

| Topic | Scope | Who may subscribe |
| --- | --- | --- |
| `dashboard` | global | `domains:access` + `list-all-domains` |
| `domains-disk` | global | `domains:access` + `view-disk-usage` |
| `postfix-queue` | global | `postfix:access` + `view-postfix-queue` |
| `rspamd-stats` | global | `rspamd:access` + `view-rspamd-stats` |
| `sessions-overview` | global | `accounts:access` + `view-account-sessions` |
| `domain-recipients:<id>` | domain | `recipients:access` + `list-recipients` |
| `domain-aliases:<id>` | domain | `aliases:access` + `list-aliases` |
| `domain-quota:<id>` | domain | `quotas:access` + `view-quotas` |
| `domain-rspamd:<id>` | domain | `rspamd:access` + `view-rspamd-stats` |
| `domain-postfix:<id>` | global | `postfix:access` + `view-postfix-queue` |
| `presence` | custom | any authenticated account |
| `notifications:<accountId>` | self | that account only |
| `ticket:<id>` | custom | row-level rule, see below |

Three kinds of authorization:

- **`global` / `domain`** -- the permission pairs listed above, root bypassing
  as everywhere.
- **`self`** -- the topic parameter must equal the caller's own account id, and
  **that check runs before the root bypass**. Root cannot subscribe to another
  account's notification feed.
- **`authorize(caller, param)`** -- a per-watcher hook that owns the whole
  decision, for rules a permission pair cannot express. `presence` returns true
  for any authenticated account, since it reveals only who is connected.
  `ticket:<id>` runs the same row-level visibility test the REST route applies,
  because ticket access is per row and a shared topic would otherwise leak
  private threads.

## Presence

Presence is a stored flag, not something derived on the fly, so one table
answers "who is online" for any number of watchers: it is the shape a chat with
200 users needs.

The column is `account_profiles.presence` (with `presence_at` next to it), owned
by [`AccountPresenceService`](../../manager-api/src/core/websocket/account-presence.service.ts).
On boot it resets every row to offline, so a crash cannot leave ghosts online
forever. The `presence` topic pushes `{ online: string[], lastSeen: {...} }`,
and [`usePresence`](../../manager-ui/app/composables/usePresence.ts) exposes
`isOnline(accountId)` and `lastSeenAt(accountId)`.

**Presence is not a session.** An account can hold a live session and be offline
here. The two are tracked separately and the session pages do not touch this.

**Idleness counts as offline.**
[`plugins/presence-activity.client.ts`](../../manager-ui/app/plugins/presence-activity.client.ts)
watches keyboard and mouse activity with VueUse's `useIdle` and reports 30
seconds of stillness to the server, which flips the account offline exactly as a
disconnection would, and back the instant activity resumes. The state is
re-announced on every reconnection, since a fresh socket starts assumed active.

Presence surfaces in three components:

- [`PresenceAvatar`](../../manager-ui/app/components/ui/PresenceAvatar.vue) --
  an avatar with a green or red dot, using `UAvatar`'s native `chip` prop, and a
  title carrying Online, Offline, or when they were last seen.
- [`PresenceModal`](../../manager-ui/app/components/ui/PresenceModal.vue) -- the
  same information reachable by tap, because a touch screen has no hover and the
  tooltip alone would hide it on mobile.
- [`SessionPresence`](../../manager-ui/app/components/ui/SessionPresence.vue) --
  the badge on the session lists.

It appears on the sidebar footer avatar, on the profile page, in the ticket
list's author column (the name turns green), in conversation avatars, and on
both session pages.

## Typing and read receipts

Both live on the ticket topic and are covered in [support.md](support.md).

- **Typing** is a throttled client signal (at most one every 2 seconds) relayed
  to the other subscribers on `ticket:<id>#typing`. The notice expires by itself
  after 5 seconds rather than waiting for a "stopped" signal a lost socket would
  never deliver.
- **Read receipts** are posted over REST and pushed back inside the thread
  payload, and are only sent when the window actually holds focus.

## Topic presence drives notifications

Subscribing to a ticket topic also tells the server that this account is reading
that thread. Anyone watching is skipped when notifications for it are dispatched,
in-app and by mail: they are looking at the message already.

Three separate concepts, easy to confuse:

- **`TopicPresenceService`** -- who is consuming which topic.
- **`PresenceActivityService`** -- whether a given socket is active or idle.
- **`AccountPresenceService`** -- the stored `account_profiles.presence` column.
