# Recipients, aliases and quotas

The three domain-scoped lists. All of them resolve their domain from the
`:domain` slug in the URL, so a deep link or a hard reload works without
visiting `/domains` first, and switching domains by editing the URL re-fetches
rather than showing the previous domain's rows (Vue Router reuses the page
instance across a param-only navigation, so the composables watch the resolved
id explicitly).

## Recipients

[`/domains/:domain/recipients`](../../manager-ui/app/pages/domains/[domain]/recipients/index.vue).
A recipient is a real mailbox: an address postfix delivers to, with a password
hashed SHA512-CRYPT before storage and a quota carved out of the domain's.

Columns: address, quota, used, active, last modification, plus row actions.
All sortable, searchable, paginated.

Row actions, each behind its own action:

- **Edit** (`edit-recipient`) opens
  [`RecipientEditModal`](../../manager-ui/app/components/domains/RecipientEditModal.vue):
  quota, active state and password. The resize ceiling is the domain's remaining
  space **plus what this recipient already reserves**, since editing frees its
  own allocation first.
- **Delete** (`delete-recipient`) confirms first, and the confirmation says what
  actually happens: the maildir is erased from disk and the quota returns to the
  domain.

### The postmaster exception

`postmaster@<domain>` is provisioned with the domain and locked for life. The
row carries a "System" badge, its actions are disabled, and a tooltip explains
that it cannot be edited, activated or deleted. The API refuses all three
independently, and refuses to recreate it too.

### Creating one

[`/domains/:domain/recipients/create`](../../manager-ui/app/pages/domains/[domain]/recipients/create.vue),
requiring `create-recipient`. The entry point is hidden without it rather than
letting the click land on a 403.

- **Local part**, letters, digits and `. _ + -` only. No domain part: the domain
  is the page you are on.
- **Password**, 8 characters minimum.
- **Quota in MB**, minimum 1, maximum the domain's remaining headroom, on a
  slider paired with a number input.

Next to the form,
[`RecipientHeadroomChart`](../../manager-ui/app/components/domains/RecipientHeadroomChart.vue)
shows the domain's allocation with the pending mailbox as its own slice, so the
size being chosen is visible against what the domain has left.

Client-side patterns mirror the API's Zod schema, which stays the authority.
Field-level errors returned by the API are mapped back onto the field that
produced them and cleared as soon as that field is edited.

## Aliases

[`/domains/:domain/aliases`](../../manager-ui/app/pages/domains/[domain]/aliases/index.vue).
An alias forwards an address, or a whole domain, to one or more real recipients.
No mailbox, no password, no quota.

Columns: from, to, domain. The **from** address is a link to the edit page (like
the recipient address), shown only with `edit-alias`. Row actions: edit (a
dedicated page) and delete behind a confirmation.

- [Create](../../manager-ui/app/pages/domains/[domain]/aliases/create.vue) --
  local part plus destination address, `create-alias`.
- [Edit](../../manager-ui/app/pages/domains/[domain]/aliases/edit/[id].vue) --
  a full page rather than a modal, `edit-alias`. It loads the alias by id and
  reports a load failure explicitly instead of rendering an empty form.

Destination validation is deliberately loose client-side: the API's
`z.string().email()` is the authority, and the local pattern only exists to
catch an obvious typo before a round trip.

## Owner account

The recipient and alias edit pages carry an **owner account** field
([`MailboxOwnerField`](../../manager-ui/app/components/domains/MailboxOwnerField.vue)):
the account a mailbox belongs to (at most one). It shows the current owner or
"no owner", an account picker (typeahead over `/accounts/names`) to **assign**,
and a **detach** action. The `GET` of a recipient/alias returns `ownerEmail` so
the field renders the current owner. `postmaster@` can never be owned, so the
field is hidden for it. This is the domain side of ownership, gated by the domain
`mailboxes` resource (`assign-*-owner` / `unassign-*-owner`); the same ownership
is also managed globally from an account (see `accounts.md`). Routes:
`PUT`/`DELETE /domains/:domainId/{recipients,aliases}/:id/owner`.

## Quotas

[`/domains/:domain/quotas`](../../manager-ui/app/pages/domains/[domain]/quotas.vue),
requiring `quotas:access` + `view-quotas`. Read-only: this page reports live
usage maintained by dovecot's dict-sql backend, it does not resize anything.

Two tables:

- **Per domain** -- a single aggregate row. Bytes written summed over the
  domain's mailboxes, shown against the domain's own quota, which is the only
  figure that says whether the number matters. Never paginated, never sorted.
- **Per recipient** -- address, quota, used, messages, last activity. Sortable
  on all five, searchable, paginated.

Quota and usage read exactly as they do on the recipients page, same labels,
same occupancy bar. What this table adds is the message count and the last
delivery date, which exist nowhere else in the console.

This page builds its own pagination state rather than using the shared
composable (two independent tables with different shapes), but it reads the same
`manager-list-limit` preference, so the page size stays consistent with every
other list.
