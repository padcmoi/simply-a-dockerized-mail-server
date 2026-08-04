# manager-ui: what the web console can do

The control plane's front end. A Nuxt 3 single-page app that talks to
`manager-api` over `/api/v1`, and to the same service over a WebSocket for
everything that has to stay live. It is the only interface to the mail stack
that is not a shell: domains, mailboxes, aliases, quotas, spam filtering,
manager accounts, permission groups, API tokens and support tickets are all
driven from here, and so is the state of the machine underneath them.

The mail backends documented in the sibling folders keep delivering mail while
this app is down. Nothing here is in the delivery path.

## Read in this order

1. [access.md](access.md) -- how you get in and what you are allowed to see:
   login, invitation, token refresh, the two global route guards, the
   permission model as the UI applies it, and the 403/404 pages.
2. [layout.md](layout.md) -- the shell every page renders inside: sidebar,
   domain scope, header, breadcrumb, the shared list toolbar, theme and
   language.
3. [dashboard.md](dashboard.md) -- the server-wide overview page.
4. [domains.md](domains.md) -- the domain list, creating a domain, the
   per-domain dashboard, and its Administration tab (status, DKIM, ownership).
5. [mailboxes.md](mailboxes.md) -- recipients, aliases and quotas, the three
   domain-scoped lists.
6. [accounts.md](accounts.md) -- manager accounts: listing, inviting, editing,
   group membership, and session administration.
7. [groups.md](groups.md) -- permission groups and the two ACL editors that
   grant everything else in this app.
8. [support.md](support.md) -- support tickets, the live conversation, and the
   notification system built on top of them.
9. [server-tools.md](server-tools.md) -- the server-wide pages: Rspamd,
   Postfix queue, Sieve blocklist, API tokens, and Supervision (the machine's
   own CPU, load, memory and network).
10. [configuration.md](configuration.md) -- the root-only Configuration area:
    outbound mail provider, email cadence, the public interface address, and the
    machine-history retention.
11. [profile.md](profile.md) -- your own account: profile, owned resources,
    sessions, notification channels, device preferences.
12. [realtime.md](realtime.md) -- the WebSocket layer underneath all of it:
    topics, presence, typing, read receipts, reconnection.

## Where the code lives

| Concern | Path |
| --- | --- |
| Pages (file-based routes) | [`manager-ui/app/pages/`](../../manager-ui/app/pages/) |
| Shared components | [`manager-ui/app/components/`](../../manager-ui/app/components/) |
| Composables (all business logic) | [`manager-ui/app/composables/`](../../manager-ui/app/composables/) |
| Pinia stores (auth, permissions, selected domain) | [`manager-ui/app/stores/`](../../manager-ui/app/stores/) |
| Route guards | [`manager-ui/app/middleware/`](../../manager-ui/app/middleware/) |
| Client plugins (WebSocket, idle reporting, locale) | [`manager-ui/app/plugins/`](../../manager-ui/app/plugins/) |
| Translations | [`manager-ui/i18n/locales/`](../../manager-ui/i18n/locales/) |
| Nuxt config, API proxy, i18n setup | [`manager-ui/nuxt.config.ts`](../../manager-ui/nuxt.config.ts) |

## Architecture in one page

- **Nuxt 3 with SSR on, data fetching client-only.** Every `useAsyncData` call
  in the app passes `server: false`. The bearer token lives in a Pinia store
  hydrated from `localStorage` on the client, so the server render has no
  credentials and would fetch nothing useful.
- **Nuxt UI v4 for every widget.** No hand-rolled component where the library
  ships one. Dark mode is a first-class requirement, not an afterthought.
- **No direct calls to the API host.** Nitro proxies `/api/v1/**` to
  `manager-api` (`NUXT_API_PROXY_TARGET`, default `http://mail-manager-api:3000`)
  and the WebSocket to `NUXT_REALTIME_TARGET`. The browser only ever talks to
  its own origin, so no CORS and no API URL baked into the bundle.
- **Every icon is bundled.** `@nuxt/icon` scans templates and ships the
  `i-lucide-*` set into the client output, so the console renders offline and
  behind a CSP that blocks the Iconify CDN.
- **Two locales, English and French**, `strategy: "no_prefix"` (the URL never
  carries the language). Translations are typed: a key added to
  [`i18n/Locales.ts`](../../manager-ui/i18n/Locales.ts) must exist in both
  locale barrels or the typecheck fails.

## Conventions this app follows everywhere

- **A page never shows a control the caller cannot use.** Permission checks
  gate the entry point, not just the request. The API refuses it too; the UI
  simply does not offer the click.
- **Every list is server-paginated, searchable and sortable** through one
  shared composable, with one items-per-page preference stored per device.
- **Every async read has a visible skeleton.** A pending fetch never shows as
  a blank gap.
- **Every write reports.** Success and failure both raise a toast, and API
  error codes are translated locally rather than displayed raw.
- **Destructive actions confirm.** Deleting a domain, a mailbox, a group or a
  session opens a modal that names what is about to be lost.
- **Mobile is a layout, not a leftover.** Every table has a card list under
  the `lg`/`xl` breakpoint, and anything reachable only by hover has a tap
  equivalent.
