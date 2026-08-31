# Domains

A domain is the unit everything else hangs off: mailboxes, aliases, quotas, DKIM
keys, spam statistics and ticket visibility are all scoped to one. Selecting a
domain also unlocks the second sidebar menu described in [layout.md](layout.md).

## The list

[`/domains`](../../manager-ui/app/pages/domains/index.vue). Columns: id, FQDN,
active, quota in MB, plus a row actions cell. Sortable on all four, searchable,
paginated.

What the list contains depends on your rights: `domains:access` alone returns
the domains you own, `list-all-domains` widens it to every domain on the server.
Both cases render the same table, which is why the page requires only `access`.

Clicking a row selects the domain into the store and opens its dashboard.

Above the table, two conditional blocks:

- **Capacity card** ([`DomainsCapacityCard`](../../manager-ui/app/components/domains/DomainsCapacityCard.vue)),
  shown to accounts that can see every domain. Total volume, free on disk,
  reserved by domains, still assignable, and an occupancy bar. It reads
  `/domains/disk`, which demands `domains:view-disk-usage`; the page skips the
  call entirely without that grant rather than raising a 403 toast about a card
  you cannot see.
- **Add a domain** card, shown with `create-domain`.

### Administer

Row action gated by [`useDomainAdmin`](../../manager-ui/app/composables/useDomainAdmin.ts).
Opens [`DomainAdminModal`](../../manager-ui/app/components/domains/DomainAdminModal.vue),
which does two things:

- **Resize the quota.** The FQDN is displayed read-only with an explicit note:
  a domain name can never change, because every mailbox address and every
  maildir path on disk is built from it. The ceiling is the free pool **plus
  what this domain already holds**, since resizing frees its own reservation
  first. `PATCH /admin/domains/:id/quota`.
- **Delete the domain**, in a danger zone behind a confirmation that names the
  domain and spells out the cascade: recipients, aliases, quota rows, DKIM keys,
  and every message stored on disk.

Both routes sit under `superadmin` (`resize-any-domain-quota`,
`delete-any-domain`), a global resource the domain-ownership bypass deliberately
cannot reach, so owning a domain does not let you resize or delete it.

## Creating one

[`/domains/create`](../../manager-ui/app/pages/domains/create.vue).

- **FQDN**, validated against a pattern client-side and normalized to lowercase
  server-side. A server-side uniqueness error is mapped back onto the field
  rather than shown as a bare toast.
- **Quota in MB**, minimum 10, maximum the currently assignable capacity. A
  slider and a number input drive the same value, and the live allocation chart
  next to the form shows the pending domain as its own slice, so the choice is
  visible against what is left before submitting. There is no unlimited quota.
- **Active** toggle.

Creating a domain provisions the (inactive) postmaster mailbox and the DKIM key
on the API side. On success the new domain is selected into the store and you
land on its dashboard.

## The domain dashboard

[`/domains/:domain`](../../manager-ui/app/pages/domains/[domain]/index.vue),
backed by [`useDomainDashboard`](../../manager-ui/app/composables/useDomainDashboard.ts).

Header: the FQDN, an active/inactive badge, and a DKIM badge whose colour
reflects the **actual DNS TXT match**, not merely the existence of a key row.
A key that was rotated but never published shows as not-ok here.

Body:

- **Stat cards** -- recipients (with active count), aliases, messages.
- **Disk quota** -- doughnut plus a breakdown: used, free, allocated, reserved
  by recipients, still assignable.
- **Top mailboxes by size**, the biggest consumers in this domain.
- **Shortcut cards** to Recipients, Aliases, Quotas and Administration. The
  Administration card carries the DKIM status icon.
- **Spam protection** ([`DomainRspamdCard`](../../manager-ui/app/components/domains/DomainRspamdCard.vue))
  -- scanned, rejected as spam, clean, greylisted, learned. Rendered only with
  `rspamd:access` + `view-rspamd-stats` on this domain, matching the dedicated
  page and the API guard.
- **Postfix queue** ([`DomainPostfixCard`](../../manager-ui/app/components/domains/DomainPostfixCard.vue))
  -- active, deferred, on hold, incoming, for this domain against the server
  total.

Key material and ownership are deliberately absent from this page. They live on
the Administration tab, behind their own resource.

## Administration

[`/domains/:domain/app`](../../manager-ui/app/pages/domains/[domain]/app.vue),
requiring `admin:access` + `view-admin-page`. A warning banner and an accordion
of three sections.

### Status

A switch that activates or deactivates the domain. A deactivated domain stops
accepting inbound mail for its mailboxes. Needs `admin:toggle-domain-active`.

### DKIM

[`DomainDkimSection`](../../manager-ui/app/components/domains/DomainDkimSection.vue).
With no key, one button generates the first. With a key, each selector renders
as a panel showing:

- the selector name,
- a badge saying whether it matches the published DNS record, evaluated only
  for the selector the check endpoint actually tested (the current one),
- the DNS record name and the full TXT value, each with a copy button,
- a delete button per selector,
- a Rotate button.

Generating and rotating both confirm first, and rotation warns that the DNS TXT
record must be updated afterwards.

Rotation needs `dkim:rotate-dkim-key` alongside `admin:manage-dkim`. Deletion
additionally needs the global `domain_owner_elevated:delete-dkim-key`: a domain
owner may rotate their own key but not delete it, unless granted that action
explicitly or being root.

### Owner

Shows the current owner, offers a picker of accounts and a transfer button.
Transferring needs `domain:transfer-domain-ownership` **plus** the global
`domain_owner_elevated:transfer-domain-ownership`, for the same reason: the
ownership bypass must not be able to hand the domain away by itself.

A domain has exactly one owner, or none. The owner holds every domain-tier
action on it without any group granting them.
