# The shell every page renders inside

[`layouts/default.vue`](../../manager-ui/app/layouts/default.vue) is three
pieces: the sidebar, the header, and a breadcrumb provider wrapping the page
slot. The `auth` layout used by `/login` and `/invite/:token` has none of them.

## Sidebar

[`AppNavigation.vue`](../../manager-ui/app/components/layout/AppNavigation.vue)
is a `USidebar` in `collapsible="icon"` mode: expanded it shows labels, collapsed
it becomes an icon rail. Open state is shared through
[`useSidebar`](../../manager-ui/app/composables/useSidebar.ts) so the header
toggle drives the same value. Under 1024px the sidebar becomes a slideover and
closes itself on every route change, because a click that navigates would
otherwise leave it covering the page.

### Global section

Built by [`useNav`](../../manager-ui/app/composables/useNav.ts). Dashboard is
unconditional; every other entry appears only if the account holds `access` on
its resource, or is root:

Dashboard, Domains, Rspamd, Postfix, Sieve, Accounts, Groups, Support,
API Tokens, Configuration (root only), Supervision.

`access` means exactly "this resource is visible to me", nothing more. What the
page then shows is gated inside the page by that resource's own listing action.
A nav helper iterating resources cannot know whether to ask for
`list-recipients` or `view-postfix-queue`, so it asks for the one action every
resource shares.

### Domain section

A second menu appears once a domain is selected, under a header showing the
FQDN with a link back to its dashboard and an X that clears the scope and
returns to `/domains`. Its entries follow the same rule, per domain:

Dashboard, Recipients, Aliases, Quotas, Administration, Rspamd.

The selection lives in the persisted
[domain store](../../manager-ui/app/stores/domain.ts). Deep-linking a
domain-scoped URL works without ever visiting `/domains` first:
[`useCurrentDomain`](../../manager-ui/app/composables/useCurrentDomain.ts)
resolves the `:domain` slug to an id and syncs the store. It also guards against
a stale different domain sitting in the persisted store while resolution is in
flight, by returning `null` until the slug and the store agree.

Highlighting is prefix-aware, since `/accounts/3/groups` is a separate leaf
route rather than a child of `/accounts` in the matched chain. The domain
dashboard entry is the exception and matches exactly, because it shares its
prefix with its five siblings.

### Footer

The signed-in account as a `UUser`: avatar (or initials), display name, email
underneath, and a live presence dot. Clicking opens a dropdown with Profile,
Preferences, a language submenu, an appearance submenu (Light / Dark / System),
and Sign out. Collapsed to the rail, only the avatar remains.

## Header

[`AppHeader.vue`](../../manager-ui/app/components/layout/AppHeader.vue): the
sidebar toggle, a title derived from the route (the FQDN when inside a domain),
then two buttons pinned right.

- **Refresh** ([`HeaderRefreshButton`](../../manager-ui/app/components/layout/HeaderRefreshButton.vue))
  re-verifies the session and permissions and bumps the shared data tick, so
  every page reloads its own data too.
- **Notifications** ([`HeaderNotificationsButton`](../../manager-ui/app/components/layout/HeaderNotificationsButton.vue))
  is the bell, with a red count chip fed over the WebSocket. Covered in
  [support.md](support.md).

## Breadcrumb

[`BreadcrumbProvider`](../../manager-ui/app/components/ui/BreadcrumbProvider.vue)
provides a ref; each page fills it through
[`useBreadcrumb`](../../manager-ui/app/composables/useBreadcrumb.ts):

```ts
setBreadcrumb([{ label: t("nav.tickets"), to: "/tickets" }, { label: ticket.subject }]);
```

`set` always prepends a Home crumb, so no page has to remember it. The error
page renders its own copy through
[`ErrorBreadcrumb`](../../manager-ui/app/components/layout/ErrorBreadcrumb.vue),
which is why a 403 still looks like a page of the app rather than a dead end.

## The shared list furniture

Four components and one composable back every table in the console.

- [`usePaginatedList`](../../manager-ui/app/composables/usePaginatedList.ts)
  builds `?limit=&offset=&search=&sortBy=&sortDir=` plus any page-specific
  filters, unwraps `{ items, total }`, and exposes `page`, `limit`, `search`,
  `sortBy`, `sortDir`, `loading`, `hasLoadedOnce` and `load`. Search is
  debounced by one second and resets to page 1. The list re-fetches on any of
  those, and on the shared refresh tick.
- [`ListToolbar`](../../manager-ui/app/components/ui/ListToolbar.vue) --
  search input, an optional `#filters` slot, a sort select that only shows below
  `xl` (above it the column headers are clickable), and the page-size select.
- [`ListSkeleton`](../../manager-ui/app/components/ui/ListSkeleton.vue) --
  shown while `hasLoadedOnce` is false. It is gated on that flag and not on
  `items.length === 0`, otherwise a genuinely empty list would re-show its
  skeleton on every reload forever.
- [`ListPagination`](../../manager-ui/app/components/ui/ListPagination.vue) --
  the pager plus a total count.
- [`ConfirmModal`](../../manager-ui/app/components/ui/ConfirmModal.vue) --
  every destructive action routes through it.

The page size is one preference for the whole console, stored per device under
`manager-list-limit`, and settable either from any toolbar or from
`/preferences`. Choices are 10, 25 and 50.

Above `lg` or `xl` (per page) lists render as a `UTable` with sticky headers;
below it the same rows render as cards. Neither is a truncated version of the
other.

## Formatting

[`useDateTime`](../../manager-ui/app/composables/useDateTime.ts) renders every
timestamp. The API answers UTC ISO-8601, which is unreadable as-is and off by an
hour or two for most viewers, so `formatDateTime` prints it in the browser's own
timezone and locale, and returns `-` for a missing or unparseable value.
`timeAgo` produces a localized relative string ("3 minutes ago") for presence
and read receipts.

## Theme and language

Both are device preferences, not account settings, so they work on the login
screen and do not follow you to another machine.

- **Theme** is Nuxt UI's colour mode: Light, Dark or System. Every page is
  built for both.
- **Language** is tri-state in the same shape, through
  [`useLocalePreference`](../../manager-ui/app/composables/useLocalePreference.ts):
  English, French, or System. System matches `navigator.languages` against the
  configured locales, exact code first (`fr-FR` to `fr_FR`), then language
  prefix. The option list shows the flag the current setting resolves to.

Both are reachable from the sidebar footer dropdown and from
[`/preferences`](../../manager-ui/app/pages/preferences.vue), which adds the
default page size.

## Refreshing on focus

Three mechanisms share one tick,
[`useDataRefresh`](../../manager-ui/app/composables/useDataRefresh.ts):

- [`useSessionRefresh`](../../manager-ui/app/composables/useSessionRefresh.ts)
  fires on window focus and on tab visibility. It rotates the token if needed,
  re-reads the profile and permissions, re-checks the current route against
  them, then bumps.
- [`useFocusHeartbeat`](../../manager-ui/app/composables/useFocusHeartbeat.ts)
  bumps on a timer while the window is focused: every 15 seconds, or 30 on a
  slow or data-saving connection. It stops while you are typing into a field,
  a checkbox or any editable element, so a reload cannot yank a half-filled
  form out from under you.
- The header Refresh button bumps on demand.

Refreshing the session without refreshing what is on screen would leave stale
data under possibly changed rights, which is the whole point of the shared tick.
