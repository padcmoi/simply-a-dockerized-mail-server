# Getting in, and what you are allowed to see

## Signing in

[`/login`](../../manager-ui/app/pages/login.vue) renders on the `auth` layout
(no sidebar, no header). It asks for an email and a password, validates both
with Zod before sending anything, and posts to `POST /auth/jwt/login`.

The response carries an access token, a refresh token and an expiry. The
[auth store](../../manager-ui/app/stores/auth.ts) keeps them, then immediately
calls `GET /auth/jwt/me` to fill in the account id, display name, avatar, root
flag and group memberships. The store is persisted, so a reload does not log
you out.

You do not land on the dashboard. You land on **the last protected page you
were on**, remembered in `localStorage` by
[`useLastRoute`](../../manager-ui/app/composables/useLastRoute.ts). Only
authenticated, non-login, non-public routes are ever recorded, and `resolve()`
refuses to return `/login`, so a stale value cannot build a redirect loop.

## Accepting an invitation

[`/invite/:token`](../../manager-ui/app/pages/invite/[token].vue) is the one
authenticated-app route that is public: the token in the URL is the credential.

It reads the invitation first and shows the email it was issued to plus the
groups that will be assigned, or a plain "not found or expired" if the token is
dead. The form asks for an optional display name and a password (8 characters
minimum). On success it does not sign you in automatically; it confirms and
offers the login link.

## Keeping the session alive

Access tokens live 15 minutes. Refresh tokens are **single-use and rotate in
place**, which drives the whole design here.

- `useApi().call()` retries once on a 401: it refreshes, replays the request,
  and sends you to `/login` only if the refresh itself fails.
- Regaining window focus or tab visibility calls `refreshIfNeeded()`, which
  rotates **only when the access token is within 2 minutes of expiring**.
  Rotating a still-valid token on every focus raced with page reloads: an F5
  landing between the server rotating and the store persisting replayed a
  consumed token and logged the user out.
- All concurrent refreshes share one in-flight promise. The 401 retry, the
  focus handler, the visibility handler and the WebSocket reconnect can all
  fire at once; without coalescing, the first rotates and the rest present an
  already-spent token.
- Signing out posts the refresh token to `POST /auth/jwt/logout`, clears the
  session, and **resets the permissions store**, so a second login in the same
  tab cannot inherit the previous account's cached rights.

## The two route guards

Both are global middleware and run on every navigation.

[`auth.global.ts`](../../manager-ui/app/middleware/auth.global.ts) decides
whether you may be here at all: unauthenticated on a protected route goes to
`/login`; authenticated on `/login` goes to the remembered route; anything else
records the current path.

[`permissions.global.ts`](../../manager-ui/app/middleware/permissions.global.ts)
decides whether *this* page is yours. It fetches
`GET /auth/jwt/me/permissions` if the store has never loaded, lets root through
untouched, and then compares the page's `definePageMeta` requirements against
the freshly fetched rows. A missing pair calls `showError({ statusCode: 403 })`.

The source of truth is always a live permissions fetch, never the JWT payload.
A long-lived token must not carry stale rights: revoking a permission takes
effect on the next navigation, not on the next login.

The same check runs again on window focus, in
[`useWindowFocus`](../../manager-ui/app/composables/useWindowFocus.ts), so a
tab left open on a page you have since lost access to flips to 403 when you
come back to it.

## How a page declares what it needs

```ts
definePageMeta({
  requiredGlobal: [
    { resource: "accounts", action: "access" },
    { resource: "accounts", action: "list-accounts" },
  ],
});
```

Domain-scoped pages use `requiredDomain` instead, checked against the currently
selected domain. `rootOnly: true` exists and refuses everyone but root.

Entries are ANDed. `access` is always spelled out even though the guard library
requires it implicitly, so the declaration states the full truth of what the
page demands. The full catalog of resources and actions, and the API routes
each one guards, is in [`../api/acl.md`](../api/acl.md).

### What each page requires

| Route | Requirement |
| --- | --- |
| `/dashboard`, `/preferences`, `/profile/*` | none beyond being signed in |
| `/domains` | `domains:access` |
| `/domains/create` | `domains:access` + `create-domain` |
| `/domains/:d` | `domain:access` + `view-domain` (domain-scoped) |
| `/domains/:d/recipients` | `recipients:access` + `list-recipients` |
| `/domains/:d/recipients/create` | `recipients:access` + `create-recipient` |
| `/domains/:d/aliases` | `aliases:access` + `list-aliases` |
| `/domains/:d/aliases/create` | `aliases:access` + `create-alias` |
| `/domains/:d/aliases/edit/:id` | `aliases:access` + `edit-alias` |
| `/domains/:d/quotas` | `quotas:access` + `view-quotas` |
| `/domains/:d/app` | `admin:access` + `view-admin-page` |
| `/domains/:d/rspamd` | `rspamd:access` + `view-rspamd-stats` (domain) |
| `/accounts` | `accounts:access` + `list-accounts` |
| `/accounts/:id`, `/accounts/:id/edit`, `/accounts/:id/groups` | `accounts:access` + `view-account` |
| `/accounts/create/*` | `accounts:access` + `invite-account` |
| `/accounts/sessions/*` | `accounts:access` + `view-account-sessions` |
| `/groups` | `groups:access` + `list-groups` |
| `/groups/:id`, `/groups/:id/owner` | `groups:access` + `view-group` |
| `/groups/:id/members` | `groups:access` + `list-group-members` |
| `/groups/:id/acl/app` | `groups:access` + `view-group` + `edit-group-global-permissions` |
| `/groups/:id/acl/domain/:d?` | `groups:access` + `view-group` + `edit-group-domain-permissions` |
| `/tickets` | `tickets:access` + `list-tickets` |
| `/tickets/create` | `tickets:access` + `create-ticket` |
| `/tickets/:id` | `tickets:access` + `view-ticket` |
| `/rspamd` | `rspamd:access` + `view-rspamd-stats` (global) |
| `/postfix` | `postfix:access` + `view-postfix-queue` |
| `/sieve` | `sieve:access` + `list-reject-senders` |
| `/api-tokens` | `api-tokens:access` + `list-api-tokens` |

## Permission checks inside a page

Route meta gates the page. Everything finer is a computed built on
[`usePermissions`](../../manager-ui/app/composables/usePermissions.ts):

```ts
const canCreate = computed(
  () => isRoot.value || (hasGlobal("tickets", "access") && hasGlobal("tickets", "create-ticket"))
);
```

Root short-circuits every one of these, matching the API, where root bypasses
the guard before the library is consulted. A domain's owner passes every
domain-tier action on the domains they own, again with no rows granted, which is
why an owner sees the full domain menu without anyone editing a group.

The one action that carries no route is `tickets:notification`: it grants
nothing on its own and gates whether the account is a candidate for support
notifications at all. See [support.md](support.md).

## When access is refused

[`app/error.vue`](../../manager-ui/app/error.vue) renders inside the normal
layout, so the sidebar and a breadcrumb stay put and the page does not feel like
a crash. It distinguishes three cases:

- **403** -- shield icon in the error colour, "Access denied". Raised by the
  route guards, by the focus re-check, and by an API 403 the page surfaces.
- **404** -- neutral, "Page not found". A ticket outside your reach 404s rather
  than 403s: revealing that a resource exists is itself a leak.
- **anything else** -- a generic "Something went wrong".

Each offers Back (history, keeping the app state) and Dashboard (which clears
the error). Titles and descriptions come from
[`i18n/locales/*/error.ts`](../../manager-ui/i18n/locales/en_EN/error.ts).
