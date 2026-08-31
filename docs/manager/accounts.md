# Manager accounts

Accounts that sign in to this console. Not mailboxes: a manager account has an
email as its login identity but no maildir, no quota and no postfix row. Rights
come from the groups it belongs to, or from the root flag, which bypasses the
ACL entirely.

## The list

[`/accounts`](../../manager-ui/app/pages/accounts/index.vue), requiring
`accounts:access` + `list-accounts`.

Columns: email, display name, groups, status, and a row actions cell. Email,
name and status are sortable. Groups is not: it is computed after the query
rather than being a real column, so there is nothing to sort on server-side.

Row actions, each gated:

- **Edit account** and **Manage groups** (`view-account`), hidden on root rows.
- **Delete** (`revoke-account`), hidden on root rows, behind a confirmation that
  warns it is permanent. It removes the account row for good: what belongs to it
  cascades away (profile, presence, sessions, group memberships, notifications,
  preferences, API tokens), while what outlives it is set to null (owned domains
  and recipients, authored tickets and messages, group ownership, audit entries,
  invitations sent), so those records survive ownerless rather than being taken
  down with the account. A root account is never deletable. Available whether the
  account is enabled or already disabled.

Above the table: a **Session management** shortcut (`view-account-sessions`)
and an **Invite user** dropdown (`invite-account`) offering by email or by
token.

## Inviting

### By email

[`/accounts/create/email`](../../manager-ui/app/pages/accounts/create/email.vue).
The invitation is sent from `postmaster@<chosen domain>` rather than a generic
sender, so it is not filed as spam. Its link points at the configured interface
address (Configuration > General, `manager_url`); the request host is only a
fallback for when no address has been set, which otherwise produced an
unreachable link behind the reverse proxy.

- **Email address** of the invitee.
- **Domain**, which decides the sending address.
- **Groups**, optional and multi-select. The default group is not listed: it is
  assigned automatically.
- **Assign recipients and aliases** -- multi-select of existing, unassigned
  recipients and/or aliases of the chosen domain to hand to the invitee (0..N of
  each). It only shows for a caller holding the global assign action, and on
  acceptance the still-unassigned ones get the new account as owner. Ownership
  only: no password is generated or changed, and nothing is shown to the invitee.
- **Domain ownership** -- a switch making the invitee the owner of the chosen
  domain. It shows the current owner and warns that a domain has one owner, so
  any existing one is replaced. It applies only when the invitation is accepted,
  which is why turning it on asks for confirmation. Without
  `accounts:set-domain-owner` the switch stays visible but locked, with the
  reason stated.
- **Dedicated domain group** -- a switch that creates (or reuses) a group
  dedicated to this domain and grants it a set of domain permissions picked
  right there in the form, and nothing else: no global permissions. The group's
  name is imposed rather than chosen, and the block says whether it already
  exists or will be created. Managing it needs the `groups` resource with all
  its actions, or root; otherwise the block explains why it is unavailable.

### By token

[`/accounts/create/token`](../../manager-ui/app/pages/accounts/create/token.vue)
is a placeholder. It states that token invitations are not available yet rather
than offering a broken form.

## Account detail

[`/accounts/:id`](../../manager-ui/app/pages/accounts/[id]/index.vue), reading
`GET /accounts/:id/overview`. Everything this account owns across the mail
stack:

- identity card (avatar, display name, email, root badge),
- stat tiles: owned domains, owned recipients, **owned aliases** and group
  memberships,
- **owned domains** and **owned recipients**, each with active counts and
  quotas, or an explicit "this account owns no domain" when there are none,
- buttons through to Edit, Manage groups, and (with the matching assign action)
  **Recipients** and **Aliases** ownership management, each shown only with its
  action.

### Recipients / aliases ownership

[`/accounts/:id/recipients`](../../manager-ui/app/pages/accounts/[id]/recipients.vue)
and [`/accounts/:id/aliases`](../../manager-ui/app/pages/accounts/[id]/aliases.vue)
manage which recipients and aliases the account owns, globally (across every
domain). A recipient and an alias belong to at most one account; `postmaster@`
is never assignable and never listed. Each page offers a domain filter and a
picker of unassigned resources to **attach** (`assign-*-owner`), and lists the
owned ones with a **detach** action (`unassign-*-owner`). Attaching one already
owned returns 409. The routes live on the accounts controller
(`GET/POST/DELETE /accounts/:id/{recipients,aliases}[/assignable][/:itemId]`) and
are gated by the global `accounts` assign/unassign actions.

### Edit

[`/accounts/:id/edit`](../../manager-ui/app/pages/accounts/[id]/edit.vue).
Email, display name, avatar URL, phone, address, and an **Account enabled**
switch whose hint says plainly that disabling blocks sign-in immediately.

### Groups

[`/accounts/:id/groups`](../../manager-ui/app/pages/accounts/[id]/groups.vue).
Add a group from a picker, remove one from the list. An account can belong to
zero, one or several groups, and permissions take effect immediately: the target
account's next navigation re-fetches them.

## Sessions

Three pages, all requiring `accounts:view-account-sessions`.

### Overview

[`/accounts/sessions`](../../manager-ui/app/pages/accounts/sessions/index.vue),
reading `GET /accounts/sessions/overview`. Every account's sessions across the
stack, grouped by account, split into two blocks:

- **Active sessions** -- accounts with at least one live session, each showing
  its live online state and a count.
- **Expired sessions** -- a searchable, sortable, paginated table of accounts
  with history, showing the expired count and when they were last seen.

Filtering, sorting and pagination for the expired block are computed client-side
over the single overview payload, since the whole set arrives at once.

### Per account

[`.../sessions/:userId/active`](../../manager-ui/app/pages/accounts/sessions/[userId]/active.vue)
lists one account's live sessions: device parsed from the user agent with a
matching icon, IP, signed-in time, and a revoke button per row plus a **Revoke
all**. Needs `revoke-account-sessions`.

[`.../sessions/:userId/expired`](../../manager-ui/app/pages/accounts/sessions/[userId]/expired.vue)
lists the history, each row marked Expired or Revoked, with a **Purge history**
button behind a confirmation stating that live sessions are untouched. Needs
`purge-account-sessions`.

The device label comes from
[`parseUserAgent`](../../manager-ui/app/utils/userAgent.ts), which extracts
browser and OS and picks an icon, falling back to "Unknown device" rather than
printing a raw user-agent string.

Online state on these pages is the presence system described in
[realtime.md](realtime.md), which is a separate concept from having an active
session: a session can be live while its owner is away from the keyboard.
