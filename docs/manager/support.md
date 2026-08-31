# Support tickets and notifications

A ticket is a conversation between the person who opened it and whoever handles
it. Tickets are a **global** resource with per-row visibility: they carry a
domain, and the domain decides who can see them, but the actions live at the
global tier so a support role can be granted once instead of domain by domain.

## Who sees what

Three filters stack, in the list and on a direct link alike:

1. **Domain reach.** Root and holders of `domains:list-all-domains` see every
   domain. Everyone else sees the domains they own plus the domains they hold
   any permission on.
2. **Visibility.** A **public** ticket is visible to everyone who can read that
   domain's tickets. A **private** one is visible only to its author and to
   support (`tickets:handle-ticket`, or root).
3. **The action itself**, `list-tickets` for the list, `view-ticket` for one.

A ticket you cannot reach answers **404**, never 403. Confirming that ticket
#18 exists would already leak something. The detail page turns that into the
normal error page rather than a blank screen.

## The list

[`/tickets`](../../manager-ui/app/pages/tickets/index.vue). Columns: subject,
domain, status, author, handled by, last update. Subject, status and last
update are sortable; search and pagination as everywhere else.

- **Subject** carries a lock or a globe icon
  ([`TicketVisibilityIcon`](../../manager-ui/app/components/tickets/TicketVisibilityIcon.vue))
  so private and public are distinguishable at a glance.
- **Author** shows the display name (or email), truncated to the column, and
  turns green while that account is online.
- **Status** is an inline select for anyone holding `handle-ticket`, so a status
  can be changed without opening the ticket
  ([`TicketStatusCell`](../../manager-ui/app/components/tickets/TicketStatusCell.vue)).
  For the ticket's own author it is a badge plus a **Close my ticket** button:
  you can always close what you opened, even without the support role.
- **Rows awaiting your reply are tinted**, like an unread message. The test is
  whether the last message in the thread was written by someone other than you.
  It is a background shade rather than another icon, because too many icons
  stop meaning anything.
- **Handled by me** is a filter button next to the page size, **on by default**,
  shown only to accounts that can take charge of a ticket. For anyone else it
  would simply hide their whole list.

Statuses are open, in progress, resolved and closed, each with its own badge
colour.

## Opening one

[`/tickets/create`](../../manager-ui/app/pages/tickets/create.vue), requiring
`create-ticket`. Subject, message, and a public/private choice whose two hints
state exactly who will be able to read it. The domain is resolved from what you
have access to.

## The conversation

[`/tickets/:id`](../../manager-ui/app/pages/tickets/[id].vue), driven by
[`useTicketThread`](../../manager-ui/app/composables/useTicketThread.ts) and
rendered by
[`TicketConversation`](../../manager-ui/app/components/tickets/TicketConversation.vue).

### Header

[`TicketHeaderCard`](../../manager-ui/app/components/tickets/TicketHeaderCard.vue):
subject, who opened it, visibility badge, status badge, and the actions.

- **Take charge** (`handle-ticket`) assigns the ticket to you and moves it to
  in progress. **The author cannot take their own ticket**, and the button is
  replaced by a sentence saying so.
- **Change status** is a select for handlers.
- For the author without the support role, a **Close my ticket** button and a
  line explaining they may close it at any time.
- A closed ticket takes no further message: the composer is replaced by a
  locked notice.

### Messages

Chat bubbles, not a mail thread. Own messages align right in a softened primary
tint, others align left in the elevated surface, each between 50% and 75% of the
container width.

- **Day separators** between calendar days.
- **Grouping**: consecutive messages from the same author within five minutes
  form one block. Only the first carries the avatar and the name, only the last
  carries the timestamp.
- **Avatars** show live presence. Clicking one opens
  [`PresenceModal`](../../manager-ui/app/components/ui/PresenceModal.vue) with
  the name, online state and, when offline, when they were last seen. A tooltip
  would be unreachable on a phone, which has no hover.
- **Read receipts**, WhatsApp style: one check means sent, two green checks mean
  read. Clicking them opens
  [`TicketSeenModal`](../../manager-ui/app/components/tickets/TicketSeenModal.vue),
  listing who read it and when.
- **Typing indicator**: three bouncing dots and "X is typing".
- **Pagination**: the last 10 messages load with the thread, and a **Load older
  messages (shown/total)** button prepends 10 more. The scroll position is
  re-anchored on the same message after a page is prepended, so the thread does
  not jump under the reader. Auto-scroll to the newest message only happens when
  you were already reading the bottom.

### Reading is signalled, not inferred

A receipt is sent when the newest message changes **and the window actually has
focus**. Having the tab open in the background is not reading it: without that
condition, a thread left open in another window would mark every incoming
message as seen while nobody is looking.

### The composer

[`TicketReplyEditor`](../../manager-ui/app/components/tickets/TicketReplyEditor.vue)
is docked at the bottom of the conversation card, iMessage style, rather than
sitting in a separate panel. It starts one line tall and grows with the content
up to a limit, then scrolls.

It is Nuxt UI's `UEditor` (TipTap) with an explicit toolbar: undo, redo, bold,
italic, strikethrough, inline code, bulleted list, numbered list, quote, code
block, link, clear formatting.

### Quoting

Clicking someone else's bubble quotes it into the composer: the author's name,
then the message capped at three lines and ending in an ellipsis when longer,
with the caret placed below it ([`quoteMessage.ts`](../../manager-ui/app/utils/quoteMessage.ts)).
A click that ends a text selection does not quote, and neither does a click on a
link, so copying an excerpt still works. Your own messages are not quotable.

### Rendering markdown without `v-html`

[`messageMarkdown.ts`](../../manager-ui/app/utils/messageMarkdown.ts) parses the
message into a description of what to draw, and
[`MessageBody.vue`](../../manager-ui/app/components/tickets/MessageBody.vue)
turns that into vnodes. Markup found inside a message therefore never becomes
markup: it stays the text it is. Rendering through `v-html` would mean trusting
text typed by a stranger.

It covers everything the toolbar can produce: headings, paragraphs, hard breaks,
bold, italic, bold+italic, strikethrough, inline code, links, bulleted and
numbered lists, blockquotes, fenced code blocks and horizontal rules.

Nested emphasis is why the inline rules are ordered longest delimiter first:
`***text***` shares its fences with bold, so testing `**` first ate two of the
three stars and left one visible in the output.

Links are filtered by [`safeHref`](../../manager-ui/app/utils/messageMarkdown.ts):
only `http://`, `https://`, `mailto:` and site-relative targets survive, and any
href containing whitespace, quotes, angle brackets or control characters is
rejected outright. `javascript:` loses its link and stays visible as plain text.

## Notifications

The bell in the header, with a red count chip, fed over the WebSocket on the
`notifications:<accountId>` topic. That topic is `self`-scoped: the gateway
checks the identity **before** the root bypass, so root cannot subscribe to
someone else's feed.

Clicking the bell opens the last 20 notifications, unread ones in bold with a
dot, each with its localized sentence and timestamp. Clicking one marks it read
and navigates to its ticket. **Mark all read** clears the count.

REST (`/notifications/feed`) is the fallback and the initial load. A session
restored from storage from before the account id was exposed carries no id and
so cannot build the topic; the composable re-reads the profile once rather than
leaving the bell on REST for the whole session.

### Who gets notified

Two conditions, both required:

1. **The global action `tickets:notification`.** It guards no route and grants
   nothing on its own. It is the trigger: without it, an account receives
   nothing, ever, whatever else it holds.
2. **Access to the ticket's domain**, plus the ticket's own visibility rule. An
   account that could not open the ticket is never told about it.

On top of that:

- **Before anyone takes charge**, a ticket is everyone's business: every
  eligible account is notified.
- **Once assigned**, it becomes a conversation between its author and its
  handler. The rest of the support stops being notified of each message.
- **The actor is never notified of their own action.**
- **Anyone currently reading the thread is skipped**, in-app and by mail alike.
  They are watching it live; telling them about a message they are looking at is
  noise. Watchers are known from the WebSocket topic subscription.

Four event types are emitted: ticket created, replied, taken, and status
changed.

### Channels and preferences

[`/profile/notifications`](../../manager-ui/app/pages/profile/notifications.vue)
lists one row per source, currently Support, with two checkboxes: **Notification**
(in-app) and **Email**. Both default to on. Turning both off stops that source
from reaching you entirely. Each toggle saves immediately and confirms with a
toast.

### Mail is a single offline summary, not a stream

Notifying by mail on every event would flood the recipient and risk getting the
server flagged as a spammer, so `dispatch()` writes only the in-app row and sends
no mail in the moment. Mail is delegated to a background sweep
([`OfflineNotificationsService`](../../manager-api/src/core/notifications/offline-notifications.service.ts)):

- A member is mailed **once** they have been offline for the configured delay,
  and only a single generic summary, "You have one or more notifications
  waiting", never one mail per message. It carries an **Open the manager** button
  pointing at the configured interface address
  ([configuration.md](configuration.md)).
- The summary goes out only when an unread notification is **newer** than the
  last one sent. The lock is a timestamp
  (`account_profiles.offline_notified_at`) that a reconnection never resets, so
  the same notification is never mailed twice. A reconnection followed by a
  genuinely new notification can trigger one more, once the member has been
  offline long enough again.
- A member whose email channel is off for every unread source is skipped, and the
  in-app bell keeps everything regardless: it is never throttled.

Independently of that, `MailerService` keeps a **per-recipient spool**: at most
one email per recipient per anti-spam window, dropping (never queuing) any send
inside it, whatever the caller (summaries, invitations, verification codes), so
no code path can turn the manager into a spam source.

The delay, the sweep frequency and the spool window are all set in
[`/config/mail-cadence`](configuration.md), not in the environment.
