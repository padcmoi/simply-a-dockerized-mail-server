# Your own account

Five pages that need no permission at all: they only ever act on the caller.

## Profile overview

[`/profile`](../../manager-ui/app/pages/profile/index.vue).

- **Identity card** -- avatar (or initials) with a live presence dot, email,
  display name, and a Root badge when applicable. Root is marked here and in the
  sidebar footer, nowhere else.
- **Action cards** -- Edit profile, Preferences, Permissions, Sessions,
  Notifications. Three more are rendered as disabled cards so the roadmap is
  visible rather than invisible: change password, two-factor authentication and
  audit log.
- **Owned resources** ([`OwnedResourcesCards`](../../manager-ui/app/components/accounts/OwnedResourcesCards.vue))
  -- the domains and recipients this account owns, with active counts and
  quotas, read from `GET /auth/jwt/me/overview`.
- **Groups** -- one badge per group, or "No group". Clicking a badge opens
  [`MyGroupPermissionsModal`](../../manager-ui/app/components/profile/MyGroupPermissionsModal.vue),
  a read-only view of what that one group grants.

The **Permissions** card opens
[`ProfileEffectivePermissionsModal`](../../manager-ui/app/components/profile/ProfileEffectivePermissionsModal.vue),
which shows the union actually in force for you across every group, global and
per domain. That is what the route guards evaluate, so it is the answer to "why
can I not see this page".

Opening the page re-reads the profile, so an edit made on `/profile/edit` is
reflected in the avatar and display name immediately.

## Editing it

[`/profile/edit`](../../manager-ui/app/pages/profile/edit.vue), rendering
[`ProfileIdentityCard`](../../manager-ui/app/components/profile/ProfileIdentityCard.vue).

Email (the login identity), display name, avatar URL, phone, and a full address
block: address line, complement, city, postal code and country, with resolved
coordinates shown when available. The country is a searchable select built from
[`countries.ts`](../../manager-ui/app/utils/countries.ts) with flags, and can be
cleared.

The avatar is edited through
[`ProfileAvatarEditField`](../../manager-ui/app/components/profile/ProfileAvatarEditField.vue),
a modal taking a URL, shared with the admin account-edit page so both behave
identically.

Everything is validated with Zod before submitting, and the whole form saves in
one `PATCH /auth/jwt/me`. The session is refreshed from the response, so the
sidebar updates without a reload.

## Sessions

[`/profile/sessions`](../../manager-ui/app/pages/profile/sessions.vue), in two
blocks.

**Active sessions** -- a small live set, one per device, fetched as a plain
array. Each row shows the device parsed from the user agent with a matching
icon, the IP, when it was signed in, its live presence, an Active badge, and a
revoke button. Revoking reloads both blocks, since the revoked session leaves
one and joins the other.

**Expired and revoked sessions** -- this grows on its own, because every token
refresh rotates a session, so it is server-paginated, searchable and sortable
like every other list. Each row is marked Expired or Revoked, and the end column
shows the revocation time when there is one, the expiry otherwise.

Note that a live session and an online presence are two different things: see
[realtime.md](realtime.md).

## Notification channels

[`/profile/notifications`](../../manager-ui/app/pages/profile/notifications.vue).
One row per notification source with an in-app checkbox and an email checkbox,
both on by default. Covered in [support.md](support.md).

## Preferences

[`/preferences`](../../manager-ui/app/pages/preferences.vue). Three device-level
settings, all stored in `localStorage` and therefore not tied to the account:

- **Language** -- English, French, or System.
- **Appearance** -- Light, Dark, or System.
- **Default items per page** -- 10, 25 or 50, the same value every list toolbar
  reads and writes.

Language and appearance are also reachable from the sidebar footer dropdown, for
when changing them is a one-click thought rather than a visit to a settings
page.
