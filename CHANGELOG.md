# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- feat(ui): the group Members tab gains two root-only header buttons, `Assign all accounts` and `Remove all`, calling the bulk membership endpoints and refreshing the member list and count in place with a success or failure toast. Both act immediately on click, with no confirmation dialog. Shown only when the viewer is root. i18n `groups.detail.members.assignAll`/`removeAll` and the matching done and failed toast strings in both locales (12-07-2026)
- feat(api): two root-only bulk membership endpoints on a group, `POST /groups/:id/members/all` assigns every known account and `DELETE /groups/:id/members/all` clears the whole membership. Both carry an empty `@RequireGlobalPermissions` (the guard short-circuits an empty requirement to allow-all) and enforce root purely in the service, deliberately not an ACL; assign is idempotent (insert-if-absent per account, existing memberships here or in other groups untouched) so re-running also folds in accounts created since the last run. Membership writes go through the guard lib and each action is audited as `group.members.assigned-all` / `group.members.removed-all`. Declared before the `:accountId` routes so `/all` is never captured as an id (12-07-2026)
- feat(ui): the profile page lists every group the account belongs to (invisible ones included, as it reads its own memberships) as clickable badges that open a modal of that group's permissions, plus a button opening a modal of the account's total effective permissions. Both modals group permissions by resource with localized resource and action labels (shared `usePermissionLabels`), render each action as a badge, and scroll when tall. Domain names come resolved from the API, so no more raw `#<id>` (12-07-2026)
- feat(api): new self-scoped `GET /auth/jwt/me/groups/:id/permissions`, gated on membership (root may read any group), returning a group's raw global and domain permissions so a member can inspect what their own group grants even when the group is invisible. Both this endpoint and `GET /auth/jwt/me/permissions` now resolve each domain-scoped permission's `domainName` server-side, so a self-scoped caller sees the FQDN even for a domain it does not own, falling back to `#<id>` for a since-deleted domain (12-07-2026)
- feat(ui): the group settings form gains a root-only `Invisible group` checkbox (hidden from a non-root, since toggling visibility is not an ACL), next to the default and protected ones. No badge or icon marks an invisible group, and the server-side filtering means a non-root never receives one anyway. i18n `groups.form.invisible`/`invisibleHint` in both locales (12-07-2026)
- feat(api): a group can be marked `invisible`, a root-only extra protection that hides it entirely from every non-root account: it never appears in the groups list (paginated list or picker) and its detail plus every sub-resource (members, permissions, owner, rename, delete) returns 404, whatever the account's membership or held permissions. Only root sees it and only root may edit anything on it, permissions included. New `is_invisible` column (migration `1783857403584`), toggling is ROOT-ONLY and deliberately not an ACL, audited as `group.visibility.changed`. A member still benefits from an invisible group's permissions by union without ever being able to see the group (12-07-2026)
- feat(ui): the group settings form gains a root-only `Protected group` checkbox (hidden from a non-root, since toggling protection is not an ACL), and a protected group shows a padlock next to its name in the groups table, the mobile group card and the detail page's name card. i18n `groups.form.protected`/`protectedHint` and `groups.protectedBadge` in both locales (11-07-2026)
- feat(api): a group can be marked `protected`, which makes it undeletable by anyone, root included. The rule lives in the lib (`guard.deleteGroup` refuses a protected group) and is honoured on `GroupsService.remove`'s own root raw-delete path too, before either delete branch. Toggling the flag is ROOT-ONLY, deliberately not an ACL action: the `edit-group` route accepts it but the service rejects a change from a non-root (a no-op re-submit passes). New `is_protected` column (migration `1783774620371`), surfaced on the group list and detail, audited as `group.protection.changed` (11-07-2026)
- chore(api): update the vendored `@naskot/custom-permission-guard` 1.3.0 tarball to the build adding per-group protection (`setGroupProtected`, `findGroupProtected`, and a `protected` flag on group reads); `pnpm-lock.yaml` follows the new `file:` integrity, the dependency reference and the unpublished version unchanged (11-07-2026)
- feat(ui): the group global-permissions grid (Application tab) shows a non-root actor only the permissions it holds itself, mirroring the server-side anti-escalation, with root still seeing the whole catalog and a resource whose actions are all hidden dropped entirely, name included. The save still spans the full catalog, so a permission the group carries that the actor cannot see is preserved rather than silently stripped. A rejected save (for example a 403) reloads the group so the checkboxes revert to what actually persisted instead of leaving a phantom checked state (11-07-2026)
- feat(api): enforce anti-escalation on every path that hands an account permissions by union, via a shared `AntiEscalationService` (new `core/acl` module) built on the lib's `utils` helpers. Editing a group's permissions is gated on the DELTA (`utils.diffPermissions` then `utils.findUnheldPermissions`), so an untouched right above the actor no longer blocks the save; adding a member or inviting an account into a group is gated on the group's whole permission set; deleting a group is gated on its global permissions. The root bypass and the HTTP error stay on the app side, the lib only answers "which of these does the account not hold". Closes the hole where `add-group-member` and invite let a non-root grant itself rights it did not hold (11-07-2026)
- chore(api): update the vendored `@naskot/custom-permission-guard` 1.3.0 tarball to the build carrying the new `utils` helper namespace (`utils.check`, `utils.findUnheldPermissions`, `utils.diffPermissions`); `pnpm-lock.yaml` follows the new `file:` integrity while the dependency reference stays `file:libs/...` and the version stays unpublished (11-07-2026)
- chore(api): vendor `@naskot/custom-permission-guard` 1.3.0 as a local tarball under `manager-api/libs/`, with the dependency pointed at `file:libs/naskot-custom-permission-guard-1.3.0.tgz`, so the unpublished 1.3.0 build ships with the repo without a registry release. Both `Dockerfile` and `Dockerfile.dev` copy the whole `libs/` folder before `pnpm install`, never a fixed tarball name, and a `.gitkeep` keeps the folder alive when it is empty, so dropping the override to return to the published npm package needs no Dockerfile change (11-07-2026)
- style(ui): move the desktop breakpoint of every page layout from `lg` (1024px) to `xl` (1280px), so tablets keep the stacked, single-column and card views up to 1279px. Every `lg:` class becomes `xl:` across all pages and shared UI components: responsive grids, the table-vs-cards toggle, the `ListToolbar` mobile sort select, and padding scales. The sidebar keeps its own 1024px switch, which Nuxt UI hardcodes in `Sidebar.vue` (`useMediaQuery("(max-width: 1023px)")`) and its theme slots, out of reach of these classes (10-07-2026)
- feat(api,ui): replace the generic `access`/`read`/`create`/`modify`/`delete` ACL vocabulary with one named action per real capability, listed per resource in `permission-catalog.ts`. `read` on `superadmin` guarded nothing and `modify` on `groups` covered both renaming a group and rewriting every permission on the server, so each route now declares the exact named actions it needs, for example `create-recipient`, `rotate-dkim-key` or `reset-rspamd-thresholds`. `access` stays the implicit prerequisite of every other action. `/accounts` and `/api-tokens`, until now root-only or ungated, carry real global actions so an administrator can delegate them, and the dead `IsRootGuard` is removed since root is a bypass, never a gate. The group permission grid, its Zod validation and its i18n labels follow (10-07-2026)
- feat(api,ui): add the `domain_owner_elevated` global resource, which withholds from a domain's owner two actions the ownership bypass would otherwise grant for free: `delete-dkim-key` and `transfer-domain-ownership`. `DELETE /domains/:domainId/dkim/:selector` and `PATCH /domains/:domainId/owner` now demand it globally on top of their domain-tier check, so a root-on-its-own-domain account must be granted it explicitly, or be a full root account, to delete a DKIM key or hand its domain away. DKIM rotation, which always leaves a working key behind, stays self-service; only deletion, which can leave a domain unsigned, is withheld (10-07-2026)
- docs(api): document the permission model in `docs/api/acl.md`, generated from the controllers' decorators: every API route with the exact permissions it demands, the named-action catalog per resource, the nine ACL-free routes, the root and domain-owner bypasses, and the two owner carve-outs `superadmin` and `domain_owner_elevated`. Indexed as entry 11 of `docs/README.md` (10-07-2026)
- feat(api): a domain's FQDN can no longer be renamed by any route, at any permission tier, root included. `PATCH /admin/domains/:domainId/rename` is deleted along with `renameDomainSchema` and its docs, and `updateDomainSchema` omits `domain` so the service has no field to write. The FK `ON UPDATE CASCADE` only rewrites the `domain` columns: `virtual_users.email`, `virtual_users.maildir`, `virtual_aliases.source` and the maildir tree under `/var/mail/vhosts/<domain>/` all keep the old name, so a rename stranded every mailbox of the domain. The admin modal now shows the FQDN disabled, with a hint saying why (10-07-2026)
- fix(api): reject unknown keys on recipient, alias and domain bodies instead of stripping them. `updateRecipientSchema` never accepted `email`, `localPart`, `maildir` or `domain`, but `z.object` dropped them in silence and the route answered `200` to a rename it had not performed. Every mutating schema is now `.strict()`, so an unknown key produces a `400` carrying an `unrecognized_keys` issue. `updateAliasSchema.localPart` stays settable on purpose: an alias is a routing rule, it owns no maildir and no quota row, so rewriting its source strands nothing (10-07-2026)
- feat(api): deleting a domain or a recipient now erases its maildir from disk through the new `MailStorageService`, which no foreign key reaches. `manager-api` mounts `/var/mail` read-write instead of `:ro`, and refuses to boot when that volume is not writable: a failed `rm` cannot be handled by the caller because the row is already gone, so the deletion would report success while the mail stayed forever. Every resolved path is proven to sit strictly under `vhosts/`, so `..`, an absolute path, the empty segment and the `vhosts/` root itself are refused and logged (10-07-2026)
- fix(api): return a deleted recipient's usage to its domain. `virtual_quota_domains` kept counting the bytes and messages of mailboxes that no longer existed, because MariaDB does not fire triggers for rows removed by a foreign key cascade, so `virtual_quota_users_after_delete_agg` never ran. `RecipientsService.remove` now deletes the `virtual_quota_users` row explicitly, before the recipient, which fires the trigger and re-sums the surviving rows. The arithmetic stays in the trigger, which already owns the aggregate (10-07-2026)
- refactor(ci): move the mail-server job's seed statements out of `.github/workflows/test.yml` and into `ci/seed.sql`. The workflow now only produces the four values and passes them as MariaDB session variables, so nothing is interpolated into a SQL literal: a bcrypt hash is full of `$` and `/`, and a here-doc that pastes it in is one bad character away from a syntax error nobody sees until CI turns red. The SQL is a plain file an editor can read (09-07-2026)
- fix(ci): supply a uuid when the test workflow seeds the admin account, which broke on `Field 'id' doesn't have a default value` since `accounts.id` became an application-generated char(36) with no database default; `install.sh` was already fixed, this seed was the last raw insert left behind (09-07-2026)
- refactor(ui): split each locale into one file per top-level namespace under `i18n/locales/en_EN/` and `i18n/locales/fr_FR/`, leaving `en_EN.ts` and `fr_FR.ts` as 49-line indexes that only assemble them. Both were nearing 700 lines and every feature touched them at a different depth. Only the first level is split: `recipients.form` and `recipients.table` stay inside `recipients.ts`. Typing holds at both levels, `satisfies Locales` on the index and `satisfies Locales["<key>"]` on each chunk, so a typo now fails in the file that contains it. `nuxt.config.ts` is untouched and still points at the two indexes (09-07-2026)
- style(ui): pointer cursor on every dropdown menu item, submenus included, since Nuxt UI's `dropdownMenu` theme only ships `data-disabled:cursor-not-allowed` and leaves an enabled entry with the text cursor; applied app-wide next to the same fix already in place for checkboxes. The domain dashboard's fullest-mailboxes chart drops from ten rows to five, the count becoming a constant the i18n title interpolates so the heading can no longer promise more rows than the chart draws, and its axis labels lose the domain suffix every single row repeated (the full address moves to the tooltip). On the domain card, Administer moves left of Access, which stays pinned right even when the former is not rendered (09-07-2026)
- feat(ui): the quotas page shows each recipient's reserved quota and an occupancy bar beside what it consumes, exactly as the recipients page does, and keeps the message count and last delivery date it alone carries. The domain aggregate reads as consumed over the domain's quota. Byte counts render in KB/MB/GB and the API's Zulu timestamps in the viewer's timezone and locale, instead of `12280649` and `2026-07-08T18:22:01.000Z`. The recipients and aliases tables gain a `lastActivity` column, labelled "last modification" since `virtual_users.last_activity` and `virtual_aliases.last_activity` carry `ON UPDATE current_timestamp()` and therefore stamp the row's last edit, not mail traffic (09-07-2026)
- feat(ui): the recipient, alias and domain create forms leave their list pages for routes of their own (`/domains/create`, `/domains/:domain/recipients/create`, `/domains/:domain/aliases/create`), reached through a clickable card that is hidden from an account without the matching `create` grant rather than letting the click land on a 403. Aliases gain an edit page at `/domains/:domain/aliases/edit/:id`, reached from a pencil button left of the delete one. The recipient and domain forms pair the quota field with a slider and a donut that both follow the typed value live, the field is clamped to the ceiling since `max` only bounds the spinner arrows, and a server refusal is pinned on the field that caused it and cleared as soon as that field is edited. A 400 on the quota refetches the headroom, since it means the ceiling moved while the page was open. `autocomplete="new-password"` stops the browser filling a new mailbox's credentials with the signed-in account's (09-07-2026)
- feat(ui): `useApiError` resolves the API's error codes under the `apiErrors.*` i18n namespace and interpolates their params, falling back to the English `message` for a code this UI does not know yet, then to ofetch's own text. `useDateTime` renders the API's UTC timestamps in the viewer's timezone and locale, keeping only the language subtag since `fr_FR`/`en_EN` are not BCP-47 tags. `useOccupancy` and `useDomainDisk` replace four copies of the occupancy maths and two copies of the `/domains/disk` fetch. A literal `@` in a locale string must be written `{'@'}`, otherwise vue-i18n reads it as the start of a linked message and refuses to compile the file (09-07-2026)
- feat(api): the quotas snapshot now carries the reserved quota each counter is measured against, `virtual_users.quota` per recipient and `virtual_domains.quota` for the domain aggregate, so a row states both what it was granted and what it uses. The recipient quota is joined in SQL rather than attached afterwards, so `sortBy=quota` orders the whole set before the page window is cut instead of reordering a page already picked by the wrong column (09-07-2026)
- feat(api): `PATCH /domains/:domainId/aliases/:id` accepts a `localPart` and renames an alias inside its own domain. The source is always recomposed as `${localPart}@${domain}` from the route's domain and never read from the body, and the local-part regex has no `@` in its character class, so no client can smuggle a domain in and have its alias land on a domain the route never authorised. A source already taken by another alias answers 409 `aliases.alreadyExists`: two rows sharing one source would make postfix's delivery depend on row order. Aliases become sortable by `lastActivity` (09-07-2026)
- feat(api): every failure now carries a stable `code` and the `params` its sentence needs, rather than an English message a bilingual UI can only print as-is. `ApiError` enumerates those codes so renaming one breaks the compile instead of silently degrading the UI to its fallback, `ZodValidationPipe` tags its own answer `validation.failed`, and the seven recipient exceptions each carry theirs along with the figures they interpolate. `message` stays on the wire for direct API clients and the OpenAPI examples. Recipients also become sortable by `lastActivity` (09-07-2026)
- feat(api,ui): a recipient's quota is now bounded on both ends, server-side. It can never exceed what its domain has left (the domain's own quota minus the quotas already allocated to its other recipients, the same rule `DomainsService` applies one level up against the mail volume), nor be lowered below the bytes the mailbox already stores, which would put it instantly over quota and make dovecot bounce its incoming mail. Lowering a quota always passes the domain ceiling, otherwise an already overcommitted domain could never be brought back under it. New `GET /domains/:domainId/recipients/headroom` feeds the create form's `1-80 MB` bounds and the edit modal's, and the domain dashboard's disk donut now shows used / reserved but unused / still assignable instead of a "free" figure that ignored reservations entirely (09-07-2026)
- style(ui): top-align the create forms of the recipients, aliases, sieve and domains pages, so a field error message no longer shifts its column against the others (09-07-2026)
- feat(api,ui): `accounts.id` and `groups.id` become application-generated char(36) uuids instead of sequential ints, since both surface publicly (the JWT `sub`, `/accounts/:id`, `/groups/:id`) and were therefore enumerable; the create-table migrations declare them as char(36) directly, and every column referencing them follows, including the four that carry an account or group id without any foreign key (`virtual_aliases.owner_id`, `virtual_users.owner_id`, `account_invitations.invited_by`, and the polymorphic `audit_log.entity_id`). `@naskot/custom-permission-guard` is bumped to 1.2.0, which opens `GroupId` to `number | string` the way `AccountId` already was (09-07-2026)
- refactor(ui): keep the `nav` i18n namespace for sidebar link destinations only and move everything else (breadcrumb-only labels, the user dropdown menu, theme toggle, sidebar collapse button, badges) to a new `layout` namespace; the domain administration page goes back to the "Administration" label under `nav.admin` (09-07-2026)
- refactor(ui): split the permission grid's resource labels into two fully distinct groups, `globalResourceLabels` and `domainResourceLabels`, mirroring `GLOBAL_RESOURCES`/`DOMAIN_RESOURCES` in the backend catalog; the i18n keys follow with `groups.permissions.resources.global.*` and `.domain.*` instead of one flat merged map (09-07-2026)
- feat(ui): show the domain administration button (rename/resize quota/delete) only to root or to an account holding the global `superadmin` resource's `access` action; owning a domain, at any domain-tier grant level, no longer reveals it (09-07-2026)
- feat(api): gate the `/admin/domains/:domainId` routes (rename, quota, delete) on the global `superadmin` resource instead of full CRUD on `domains`; each route asks for the `superadmin` actions matching its own job, so a domain owner never qualifies whatever their domain-tier grants (09-07-2026)
- refactor(api): type `@RequireGlobalPermissions`/`@RequireDomainPermissions` from the ACL catalog itself -- the generic `PermissionRequirement` (raw `string` resource/actions) is replaced by `GlobalPermissionRequirement`/`DomainPermissionRequirement`, built from `GLOBAL_RESOURCES`/`DOMAIN_RESOURCES` and `PERMISSION_ACTIONS`, so a wrong resource or action string is now a compile error at the call site instead of a runtime config error (09-07-2026)
- feat(ui): `superadmin` resource label ("Super admin" / "Super administrateur") in the group global-permissions grid, wired into `usePermissionLabels`'s resource map (09-07-2026)
- feat(api): new `superadmin` global resource -- checking its `access` action in the group permission grid cascades to grant full CRUD on every other global resource at once, via `GLOBAL_RESOURCES_DEPENDS_ON` generated from `GLOBAL_RESOURCES` (09-07-2026)
- style(api): format `permission-catalog.ts`'s resource arrays one entry per line (08-07-2026)
- refactor(ui): rename the ambiguous "Administration" label/routes to "Application" -- `/domains/:domain/admin` -> `/domains/:domain/app` and `/groups/:id/acl/admin` -> `/groups/:id/acl/app`, plus the matching i18n keys (`nav.administration` -> `nav.application`, `groups.detail.tabs/alerts.administration` -> `.application`); the domain rename/quota/delete modal keeps "Administration" since it's a distinct concept (08-07-2026)
- feat(api,ui): harden domain admin ACL so rename/quota-resize/delete are only reachable via dedicated `/admin/domains/:domainId` routes (rename, quota, DELETE) requiring full CRUD on the global `domains` resource, immune to domain ownership (no ownership bypass exists at the global tier, unlike every domain-scoped resource); the domains list now scopes results to the caller's own domains when they hold `access` without `read`; domain administration modal (rename/resize quota/delete with confirmation), per-domain occupancy progress bars and used/quota text in the domains list, quota shown in MB/GB (08-07-2026)
- feat(api,ui): recipient quota consumption -- per-recipient usage joined from `virtual_quota_users` and sortable at the SQL level (`sortBy=usedBytes`), used/quota text with an occupancy progress bar in the recipients list, quota entered in MB on the create form (1 MB minimum, matching the existing backend floor), and a dedicated edit modal (quota/active) gated by the classic `recipients:modify` ACL; postmaster@ stays excluded from the new edit action, same as delete (08-07-2026)
- feat(api,ui): Bayesian classifier stats table (`BAYES_SPAM`/`BAYES_HAM` learns/users) and a full stat tile row (scanned/no action/greylist/add header/rewrite subject/reject/learned, always shown even at zero) on both the global and per-domain Rspamd pages; tiles moved out of the stats card to the top of the page, donut+legend centered as a group with grid-aligned values (08-07-2026)
- feat(api,ui): editable Rspamd action score thresholds (greylist/add header/rewrite subject/reject) with a reset-to-defaults action, gated by the "rspamd" resource's modify+delete actions together (stricter than every other rspamd endpoint, since a bad value can silently break spam filtering server-wide); `GET`/`PATCH`/`DELETE /rspamd/actions` proxy Rspamd's own undocumented `/actions`/`/saveactions` endpoints, validating non-negativity and strict descending order server-side since Rspamd itself enforces neither (08-07-2026)
- feat(api,ui): DKIM DNS-match status badge (green/red, driven by `GET /domains/:domainId/dkim-check`) next to each key on the Administration page and on the domain dashboard header/Administration card; refreshed automatically after every key rotation or deletion (08-07-2026)
- feat(ui): dedicated per-domain Rspamd page (`/domains/:domain/rspamd`), a structural twin of the global admin one -- stats donut + paginated/searchable/sortable scan history, desktop table + mobile/tablet cards; new sidebar nav entry after Administration. The global `/rspamd` page gains the same mobile/tablet card list it was missing, and its stats card is now a shared `RspamdStatsCard` component reused by both (08-07-2026)
- feat(ui): `ConfirmModal` supports two confirmation modes -- `wait` (existing 10s countdown, auto-confirms unless canceled) and `clicks` (click Proceed 10 times in a row, no timer), selectable per call-site via a new `confirmMode` prop; `clicks` is now the default across every existing usage (08-07-2026)
- feat(api,ui): activate/deactivate a domain from its Administration page -- new `PATCH /domains/:domainId/active`, gated by the "admin" domain resource (`access`+`modify`) rather than the general `domain` modify used by the existing `PATCH /domains/:domainId`, since this is specifically an Administration-page action (08-07-2026)
- feat(ui): rebuild the domain Administration page as an accordion (Statut du domaine / Clés DKIM / Propriétaire) instead of 3 stacked always-open cards; new reusable `ContentPanel` component gives each section's content the same bordered-box look, used consistently across all three (08-07-2026)
- refactor(ui): organize `components/` into business-domain subfolders (`accounts/`, `api-tokens/`, `domains/`, `groups/`, `sieve/`, `ui/` for cross-cutting components reused across every domain, plus the existing `charts/`) instead of one flat 27-file directory; `nuxt.config.ts` sets `pathPrefix: false` so every component keeps its existing tag name regardless of subfolder -- `<ChartsBarChart>`/`<ChartsDoughnutChart>` (the one pair that relied on the old default prefixing) become `<BarChart>`/`<DoughnutChart>` (08-07-2026)
- feat(ui): split the single-page group detail view into dedicated routes -- `/groups/:id` (name/description, the default landing page), `/groups/:id/owner`, `/groups/:id/members`, `/groups/:id/acl/admin` (global permissions) and `/groups/:id/acl/domain/:domain` (domain permissions, addressed by FQDN like every other domain-scoped page); a shared card grid navigates between them, each with its own breadcrumb (08-07-2026)
- feat(api,ui): extend the `dependsOn` permission gate to global (non domain-scoped) resources, mirroring the existing domain-tier mechanism -- `@naskot/custom-permission-guard` bumped to 1.1.0 (adds `dependsOn` support to global resource schemas); `GET /groups/permissions/catalog` now returns `global.dependsOn` alongside `domain.dependsOn`; the permission grid's dependency cascade (grant-on-check, clear-on-uncheck) now applies identically to both tabs instead of only the domain one. No global resource currently declares a dependency -- the catalog starts empty, ready for one to be added without further code changes (08-07-2026)
- feat(ui): `ConfirmModal` supports a non-destructive "warning" variant (button/progress-bar color, proceed label, countdown hint) so a disruptive-but-reversible action like DKIM key rotation no longer reads as a deletion; DKIM keys section is collapsed by default since it reveals private key material (08-07-2026)
- feat(api,ui): expose the group permission catalog (resources, actions and their `dependsOn` requirements) via `GET /groups/permissions/catalog` instead of hardcoding a copy of it in the frontend; the permission grid now enforces dependencies interactively -- checking a dependent resource's action grants its prerequisite(s), clearing a prerequisite action clears every resource whose requirement included it (08-07-2026)
- feat(api,ui): dedicated Administration page per domain (DKIM key management + ownership transfer), gated by a new "admin" domain ACL resource separate from the day-to-day dashboard; the dashboard now shows only a generated/missing indicator for DKIM instead of exposing key material inline (08-07-2026)
- refactor(api): extract the resource/action/dependsOn permission catalog into a single canonical file (`permission-catalog.ts`), removing duplicate declarations from the guard service (08-07-2026)
- feat(api,ui): sort by any listed column (not just the one chronological dimension), on every table; desktop clicks a column header (direction arrow), mobile/tablet picks a column x direction combo from a select since there's no table header to click there. Each endpoint validates `sortBy` against its own whitelist of real columns, falling back to its previous default when absent or unrecognized -- never a raw passthrough to `ORDER BY`. Computed/joined fields with no real backing column (accounts' group list, groups' owner/member count) stay unsortable (07-07-2026)
- feat(ui): show each table's total row count next to its pagination control, via a single reusable component shared across every list (accounts, domains, groups, sieve, recipients, aliases, quotas, Rspamd history) (07-07-2026)
- feat(ui): skeleton loaders for every page's initial data fetch (accounts, domains, groups, sieve, recipients, aliases, quotas, Rspamd, both dashboards, profile), replacing blank/zeroed flashes while data loads (07-07-2026)
- feat(ui): persist the "items per page" list preference across every table in localStorage (06-07-2026)
- feat(api,ui): server-side pagination (10/25/50 max), free-text search and chronological sort direction (newest/oldest first) on every tabular list (accounts, domains, groups, blocklist, recipients, aliases, quotas, Rspamd history); additive so the dashboard and picker selects keep receiving the full unpaginated set (06-07-2026)
- feat(ui): Home breadcrumb entry linking to `/` on every page (06-07-2026)
- feat(ui): dedicated per-account pages to manage group membership and edit profile fields, reachable from the accounts table (06-07-2026)
- feat(api): account detail endpoints (`GET`/`PATCH /accounts/:id`) for editing profile fields and enabled status (06-07-2026)
- feat(api,ui): support multiple groups per account, replacing the single `group_id` column with a `group_members` join table (06-07-2026)
- feat(api): migrate ACL engine to the published `@naskot/custom-permission-guard` npm package (assertOne/assertAll, domain ownership bypass, global→domain bridge, dependsOn gate, cross-group anti-lockout); root stays an external, unconditional bypass composed on top, never a library concept (05-07-2026)
- docs(api): complete OpenAPI/Swagger coverage on every route (params, request bodies, every real HTTP status code) + fix login/refresh/logout/revoke to return 200 instead of 201 (05-07-2026)
- feat(api,ui): domain ownership (auto-assigned to the creator, single owner or none, PATCH owner transfer restricted to root or the current owner, ownerUsername resolved in API responses) (04-07-2026)
- feat(api): groups anti-lockout - a permission write can never leave zero groups able to manage groups themselves, root exempt (04-07-2026)
- feat(api,ui): Administration > Domains acts as a system-wide override (bridge) for the domain-scoped "domain" resource only, never recipients/aliases/quotas/dkim/spamd (04-07-2026)
- feat(ui): account badge (Root / group name / no group) next to the username in the sidebar (04-07-2026)
- feat(api,ui): domains.access alone unlocks nav + disk stats, domains.read additionally unlocks the domain list (04-07-2026)
- feat(ui): page data refreshes on window focus / tab visibility regain, not just session and permissions (04-07-2026)
- feat(api,ui): enforce minimum quotas (10 MB domains / 1 MB recipients) and lock postmaster@<domain> against activation, edits, deletion and recreation (03-07-2026)
- feat(ui): core composables - useAutosave, useGroups, useHeaderTitle, useNav, usePermissions, useSessionRefresh, useWindowFocus (03-07-2026)
- feat(api): full ACL enforcement - PermissionGuard applied to all controllers (domains, recipients, aliases, quotas, dkim, spamd, sieve, rspamd, postfix, accounts/names) (02-07-2026)
- feat(api): GET /auth/jwt/me/permissions endpoint returning effective global and domain permissions for the current user (02-07-2026)
- feat(ui): standalone /postfix page (global queue stats) + nav item gated on postfix.view permission (03-07-2026)
- feat(ui): profile page permissions section showing group, global and domain permissions with action badges, refreshed on mount (02-07-2026)
- feat(ui): nav items filtered by user permissions, page-level guard redirects to dashboard on 403 (02-07-2026)
- feat(api): GET /accounts/names endpoint (id+username+name) accessible to any authenticated user for group selectors (02-07-2026)
- feat(api): group ownership (owner_id FK ON DELETE SET NULL, PATCH owner, member add/remove for owner or root) (02-07-2026)
- feat(api): permission self-check: non-root can only assign permissions they already hold (02-07-2026)
- feat(ui): group detail page with owner section, member management, and separate edit page (02-07-2026)
- feat(api): groups ACL with global and domain permissions, PermissionGuard, seed operator account (02-07-2026)
- feat(api): direct account creation and group assignment endpoints for root (02-07-2026)
- feat(ui): groups management page with inline UTree permissions panel (resource+action checkboxes, no modal) (02-07-2026)
- feat(api): dual JWT + API token auth with X-Api-Key header sms_clientId.secret and full CRUD (02-07-2026)
- feat(ui): API token management page with CRUD, regenerate and optimistic state updates (02-07-2026)
- feat(ui): reveal modal clipboard guard and auto-delete token on dismiss without confirm (02-07-2026)
- feat(api): Swagger single X-Api-Key field, remove JWT from OpenAPI security schemes (02-07-2026)

- Domains spamd sub-module with per-domain history and stats routes, fix DKIM generate button _(api)_ [459d114](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/459d114ef8367fdbc6c797acf34405230ed1179f) (01-07-2026)
- DKIM confirm dialogs and collapse-aware generate button _(ui)_ [c7d5fa5](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/c7d5fa53ec2cb58203f71242692f7baa49b1e5b3) (01-07-2026)
- Account domain ACL and invitation management _(api)_ [2b0c776](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2b0c776df759325a4fbd904ac48fee513c5dc391) (01-07-2026)
- Refresh-token rotation and profile update endpoint _(api)_ [ba016f1](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ba016f1fee65e6fd6d4d7f17b25984a95fe90013) (01-07-2026)
- Add OpenAPI decorators to all endpoints _(api)_ [e7282d2](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e7282d2c532cf1b17ab59b36134668ab8ebbbdf2) (01-07-2026)
- Per-domain dashboard, auto-refresh, DKIM collapsible, Rspamd/Postfix cards, Swagger proxy fix _(ui)_ [fa84e46](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/fa84e4668de4f68c3c6e58caa820335d40173b5c) (01-07-2026)
- Rspamd and Postfix queue stats proxy endpoints with JWT auth _(api)_ [802e1c7](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/802e1c7f948ec0be01741dfd06ad3514f3e1ecb7) (01-07-2026)
- Add breadcrumb on static pages (dashboard, sieve, accounts, profile) _(ui)_ [60d836a](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/60d836a9b49ea574652ebd70b34bd942164762c2) (01-07-2026)
- Per-domain FQDN routes, domain guard middleware and domain-scoped recipients/aliases/quotas _(ui)_ [0a4172d](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/0a4172d66d55df60a024764677db642114e5f7d6) (01-07-2026)
- Domain-centric sidebar layout with per-domain nav and login redirect to dashboard _(ui)_ [6109f35](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/6109f3510c3c6268ff226ee2c6643a76075fc4d8) (01-07-2026)
- Add breadcrumb composable and BreadcrumbProvider wrapper component _(ui)_ [0867f53](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/0867f5365d81fd5e2c815e362a29ad55e0e66215) (01-07-2026)
- Add domain Pinia store with localStorage persistence _(ui)_ [f1ed7c9](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/f1ed7c9baa62f7ab1e5eaeadb206d83a205b98e0) (01-07-2026)
- Migrate charts to vue-chartjs, add Husky pre-commit/pre-push hooks _(ui)_ [57b3fde](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/57b3fde391df8ccfc94588d65e0eb32168cbdfc0) (01-07-2026)
- Dedicated dev overlay with hot-reload for manager-api and manager-ui _(dev)_ [b415517](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/b4155174dd6b715f596d5380171863e9900a2209) (01-07-2026)
- Reusable ConfirmModal with 10s countdown before deletion _(ui)_ [1f0bc8a](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1f0bc8a528060003fed93357d9bf242cf68a57fc) (01-07-2026)
- Responsive card layout for all tables on mobile/tablet _(ui)_ [1742f2b](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1742f2b168b815bcb474553470e098a16cd7f5ae) (30-06-2026)
- Manager ACL with root-only invite flow and per-domain access control _(accounts)_ [784d369](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/784d36963b1defee6900567a9a72657155040b20) (30-06-2026)
- Mail volume capacity gauge + i18n FR/EN with typed contract _(manager-ui,manager-api)_ [ef02569](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ef0256946f7c7cd9edeaef77243fe2b449d8b1bf) (30-06-2026)
- V2 dashboard layout + account profile (email, name, avatar) _(ui,api)_ [f5f4ac4](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/f5f4ac4b3f3b7eba908ca73d9a59834442f663e7) (30-06-2026)
- Persist dkim_keys + resumable install.sh _(install,dkim)_ [31a3e3e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/31a3e3e912657c5cb1f1014bea57e740468fc0f1) (30-06-2026)
- GET /api/v1/health returns a real cpu/mem/redis/db/mail snapshot _(health)_ [26f8f40](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/26f8f40858375977fdf56181f273724ccd08672c) (30-06-2026)
- Consume /api/v1, swagger moved to /api/doc _(ui)_ [9c12cd9](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/9c12cd9cde0efc37e111c68d888ec61e3dad32fe) (29-06-2026)
- URI versioning /api/v1 + jwt auth in core/auth/jwt _(manager-api)_ [a3f9a76](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/a3f9a76b6ab62f7b44ff6da57e05938378e8f36d) (29-06-2026)
- Typeorm migrations split by business domain + db:* scripts _(db)_ [06b44f4](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/06b44f4a1810f3fae777a6590d7eeaa442464d8b) (29-06-2026)
- Rename date_creation -> created_at + cover blacklist with a test _(sieve)_ [3a14987](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/3a149877351d03758c7564cd82b6c56296d8eeda) (29-06-2026)
- Snake_case tables, user_start_date/user_end_date activity window, dkim_keys table _(mail)_ [f5b7446](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/f5b74463ad034b986b292b76db7548dc4fdef937) (29-06-2026)
- Managesieve-visible per-sender auto-routing with system-folder-aware undo _(autorouter)_ [03e8efc](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/03e8efc061ee54800fbf550834ef84f79cdf44cf) (28-06-2026)
- Unified ATTACHMENT_MAX_SIZE_MB knob (default 25, Gmail parity) _(attachments)_ [6a7357f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/6a7357f5e9655e72698a4f85a27b9809cad25d2a) (28-06-2026)
- Enable markasjunk plugin for one-click spam toolbar button _(roundcube)_ [1fe8bae](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1fe8bae3685d0b5637bae3e896f929fb4c97bd43) (28-06-2026)
- Sa-learn-pipe orchestrator + per-concern hooks + postmaster one-shot _(dovecot)_ [071d585](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/071d5850758d6a2d04cf024e2fe7436ba3f6b8fd) (28-06-2026)
- Imap_sieve + learn-spam/ham sieves with Trash exemption _(dovecot)_ [9a18c6c](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/9a18c6c9a045443a17b35c35d422ba5e6bf6587a) (28-06-2026)
- USER_BLOCKLIST + GLOBAL_BLOCKLIST + RECIPIENT_RECORDER lua rules _(rspamd)_ [0947696](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/09476961ce53bb7909cf57f39886115009aeadc4) (28-06-2026)
- Explicit action thresholds, sieve-aligned spam header, greylist off _(rspamd)_ [1e90eba](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1e90eba3daaaa5966c947aaccafad1edefd3c8d0) (28-06-2026)
- Always-on ClamAV antivirus with reject action _(rspamd)_ [1967b60](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1967b60e018ab31c615c5f3eda8b8e373544346d) (28-06-2026)
- Per-user bayes classifier wired to Redis selector _(rspamd)_ [eed5daf](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/eed5daf1fa818c9fdefeb9fdd1534fef2cfbaf8b) (28-06-2026)
- Install certbot deploy hook that restarts dovecot+postfix on cert renewal _(install)_ [6b93ea2](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/6b93ea23759d482c8ad67c3c5a70598f0628c798) (27-06-2026)
- Manage keys through an opendkim Python sidecar consumed by manager-api and install.sh _(dkim)_ [c5073fd](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/c5073fd87fcd8d15ed7012834e40ad67e063e33e) (27-06-2026)
- Accept short language aliases (fr, FR, en, ...) for Roundcube locale prompt _(install)_ [2ac7ad0](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2ac7ad0b5056836df1df6ad2d525110cdc229b05) (27-06-2026)
- Configurable default language via ROUNDCUBE_LANGUAGE _(roundcube)_ [f471b81](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/f471b8163ded4cd760ca34cff25ef7341ed29efb) (27-06-2026)
- One-shot interactive bootstrap with regex-validated prompts _(install)_ [3ce61af](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/3ce61afe04263b9dfe08324aabd99ccf6a604e18) (27-06-2026)
- Install.sh secret generation and service.sh compose wrapper _(ops)_ [ff17bb2](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ff17bb288c59e3885ed74d4afd58b8cb8027f799) (27-06-2026)
- Nuxt UI v4 admin pages with Nitro proxy to manager-api _(manager-ui)_ [1b6007e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1b6007e109edbedadedecfab4d3ebd7c48ada098) (27-06-2026)
- JWT auth with refresh tokens backed by Accounts table _(manager-api)_ [84997ff](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/84997ffdd16e3e1f63938492c01daac78db1362b) (27-06-2026)
- NestJS scaffold for domains, users, aliases, quotas and sieve _(manager-api)_ [d7b4944](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d7b49448367da9a6f80a9c65f53cb4b3d457a938) (27-06-2026)
- Internal docker DNS and plaintext managesieve over bridge _(roundcube)_ [3b64680](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/3b64680585731dbac764f477aad61313eba53700) (27-06-2026)
- Opendkim, opendmarc, rspamd and clamav images _(antispam)_ [0a68108](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/0a681088e8c73be40a00abc4be7104df774640b7) (27-06-2026)
- LMTP, IMAPS and managesieve with dict-sql quota _(dovecot)_ [ceb685f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ceb685fbcf2a5232e19cd7f6d357ef9a41a5753e) (27-06-2026)
- MySQL-backed virtual delivery with milter chain _(postfix)_ [efc8a49](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/efc8a4982bb45bcd627bad4c8471f38c22413f5b) (27-06-2026)
- V1-compatible schema with live quota aggregation triggers _(mariadb)_ [3bce30d](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/3bce30d28fb0c2992a03af59fb96b595b8026ef2) (27-06-2026)
- Multi-container docker-compose with BINDING_PORT/IP env scheme [1f19b91](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1f19b916a941bd31c841c94c689a325820ceb5a1) (27-06-2026)

### Changed

- style: remove em dashes from code comments, log/tooltip strings and UI copy across `manager-api` and `manager-ui` (08-07-2026)
- refactor(ui): nest recipients/aliases/quotas under `/domains/:domain/` instead of flat routes driven by an implicit store selection, matching the domain dashboard's own URL and making each page directly bookmarkable and deep-linkable per domain (07-07-2026)
- refactor(ui): migrate page and composable data fetching to `useAsyncData`, deriving the loading state from `status` instead of `pending` so the skeleton is what the server actually renders instead of flashing empty/zero values on hard reload, and gating it on a one-shot "has loaded once" flag so it never reappears on a page/sort/search reload of an already-empty list (07-07-2026)
- refactor(ui): replace native `<select>` pickers with `USelectMenu` (group/member/owner assignment), showing each item's description (06-07-2026)
- refactor(ui): full-width layout and consistent alert banners across every page (dashboard, rspamd, postfix, group detail, profile, api-tokens) (06-07-2026)
- Format all shell scripts with shfmt _(scripts)_ [758161f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/758161fdbb963719439420ca590b2e5d52797c34) (01-07-2026)
- Mailserver tests disabled as too heavy _(husky)_ [7010223](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/7010223ef0009bebe8328f47945806099ece7b53) (01-07-2026)
- Apply prettier formatting to all TypeScript and Vue source files [2003027](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2003027ae24d1ea3a67c1b9bc056c10fffb1f0b1) (01-07-2026)
- Move Rspamd and Postfix services to src/core, api layer is route-only _(api)_ [2f1c174](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2f1c174e8bcdd4ec4b90afa712d9901712938fb2) (01-07-2026)
- Add commit hash link and date format to all entries _(changelog)_ [24fb0a0](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/24fb0a0d24f70ce71acae33e07fcfb3a14a20128) (01-07-2026)
- Add commit hash link and date to every entry _(changelog)_ [e123f14](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e123f14f867609dd61a70eee03cf60675d67ce25) (01-07-2026)
- Auto re-stage reformatted files and enforce dated CHANGELOG entries in pre-commit _(dev)_ [639ca6b](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/639ca6b3ef37e4b19c390e0130dc2a784c61ee91) (01-07-2026)
- Trigger test-mailservers.sh on pre-push for images/ and tests/ changes _(dev)_ [b75856b](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/b75856bbca0596381bddf39fb5822e745589c00a) (01-07-2026)
- Move CHANGELOG check to pre-commit, tests to pre-push _(dev)_ [4af78f6](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/4af78f6a932f1b0da59a6577cc386e5a1a0b802b) (01-07-2026)
- Add npm lockfile for root husky install [efa304a](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/efa304a3c96d1edc148ab7347404b41b2c99ca64) (01-07-2026)
- Add roundcube to docker dev container _(dev env)_ [1f103a3](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1f103a335814fcf272e8064c76dcc76ada88fcfd) (01-07-2026)
- Promote roundcube to base stack in docker-compose.yml _(compose)_ [aede609](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/aede609237a885254637dbe2421d69288c28a908) (01-07-2026)
- Drop WEBMAIL env var and roundcube choice prompt from install.sh _(install)_ [d5e8933](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d5e89334f15860a18e445e6acd3c98acd0a94dba) (01-07-2026)
- Add test-node.sh to run typecheck/lint in manager-api and manager-ui [08fccd3](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/08fccd3f3673dcbb85b79ba6e066d7bb6136073c) (01-07-2026)
- Chain lint/typecheck/test jobs sequentially for 5-step pipeline view [555869a](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/555869acb7d0d370169412bdced8cd0784d5a511) (01-07-2026)
- Split lint/typecheck jobs and rename mail server test job [c4d1938](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/c4d19382ae52a666738653fe0513a03139c123de) (01-07-2026)
- Add prettier.sh to format manager-api and manager-ui [e6f8be7](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e6f8be733c94b6ff0c331e84b65fac7751fc8eb3) (01-07-2026)
- Format account component _(prettier)_ [e89dc07](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e89dc070038c251cf36c0d7b62a3721f88a71ae9) (30-06-2026)
- Merge lint jobs into test.yml, gate test on lint passing _(ci)_ [22753b9](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/22753b9d0e477aec86d0dfd18240f4d8c4d97ef8) (30-06-2026)
- Ignore tsconfig.tsbuildinfo build artifacts [89afe16](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/89afe1611b027f3ee2aaf5ace860408961b2ec73) (30-06-2026)
- Make lint self-contained with nuxt prepare in package.json _(ci)_ [7c1b537](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/7c1b537371e737fa9e43aef57a233711b7d1f7b7) (30-06-2026)
- Run nuxt prepare before lint in manager-ui CI job _(ci)_ [0f6d3ce](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/0f6d3ce99cf484bc486345b61957f84e66b1fdb0) (30-06-2026)
- Update manager-api lockfile with nodemailer _(deps)_ [ea80721](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ea8072170280803413841fb3514890b118fa8ee8) (30-06-2026)
- Add dedicated lint and typecheck workflow for manager-api and manager-ui _(ci)_ [0055cd1](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/0055cd1f4c64348e76aff1a42976be574ef6c5a0) (30-06-2026)
- Wire eslint + typecheck on both packages, fix all violations _(lint,typecheck)_ [4ff1b13](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/4ff1b137d18a7db62ea09aa824fc695adb04ae3d) (30-06-2026)
- Nest resources under /domains/:domainId, rename users -> recipients _(api)_ [64f5876](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/64f5876a85a7d28da9a17f4a1a995602a0f65536) (30-06-2026)
- Split src into /api (routes) + /core (shared) _(manager-api)_ [5cb1007](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/5cb1007907a48f11f694ccdafde79811f1d5db1b) (29-06-2026)
- Split per-service files, optional roundcube overlay _(compose)_ [49dac01](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/49dac0155025c33855caa1bfe4e6cb9cef9abbdb) (29-06-2026)
- Github actions workflow runs ./test-mailservers.sh on every branch _(mail)_ [2446c1a](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2446c1ac677821cbae9a9c268b92c25c4059c550) (29-06-2026)
- Consolidate duplicated Added/Changed/Fixed sections _(changelog)_ [970a8e4](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/970a8e485025064bf09077979655cf01bcb5c765) (29-06-2026)
- Postmaster reservation + fail2ban/postfix/log-perms fixes _(changelog)_ [fe64c7c](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/fe64c7cdc621d5b472033dfe3df433f95aec991c) (28-06-2026)
- Per-feature READMEs under docs/ _(mail)_ [0671d1b](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/0671d1b9d5acbbc147ad3e861ca590adf4fd705d) (28-06-2026)
- Bind-mount redis data under ${VOLUMES_PATH}/redis _(redis)_ [bf3a373](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/bf3a373d79bf527a15d4500c4d58528425855dc2) (28-06-2026)
- End-to-end mail-server test suite _(mail)_ [9baebc1](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/9baebc1f09e3c53da6697fd8be640e2891dabd2c) (28-06-2026)
- Rspamd/dovecot per-user blocklist + notification + Junk-only policy _(changelog)_ [88bf742](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/88bf74258db516fd09900f6faab746437e431584) (28-06-2026)
- Add prettier (double quotes, semi, es5 trailing, printWidth 130) to manager-api and manager-ui [4832ec5](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/4832ec5d3ac9008a649186cf5d63a0d70199bfa1) (27-06-2026)
- Dovecot healthcheck + postfix and roundcube wait for service_healthy _(compose)_ [e339d32](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e339d3235e9868ad57cbc2f09b9a3e05458c8a19) (27-06-2026)
- Gitignore INSTALL_INFO.txt [1bbdb1e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1bbdb1ef2f4922b1500c55f61448ba387f3969a4) (27-06-2026)
- Rewrite INSTALL.md and update CHANGELOG for the installer overhaul [7c3f786](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/7c3f786a91ccd5159a097b3e0d983b5d09cb9396) (27-06-2026)
- Split init scripts per database (roundcube, opendmarc) _(mariadb)_ [28d21d3](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/28d21d3921d135cae9d8f31add0b3f20432996ec) (27-06-2026)
- Generate v1-compatible schema via TypeORM synchronize and install triggers via Nest bootstrap hook _(manager-api)_ [ac30865](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ac3086576078fa94c9e2c067c11de441576cda9d) (27-06-2026)
- Update CHANGELOG, gitignore and LICENSE for v2 [08b9120](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/08b91203020d20ed7ef35a6b0832e1e13d02e907) (27-06-2026)
- Rewrite README, INSTALL and add DOMAIN_DNS for v2 stack [0cfcc7e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/0cfcc7efe4e2a01dc41987051a6e502b70c6f145) (27-06-2026)
- Drop v1 monolithic stack (Dockerfile, docker-build, libs, webadmin) [0e139b1](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/0e139b171175f7e26894786d286629e32ca3495c) (27-06-2026)
- Add to gitignore [81aea8d](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/81aea8d103e51f72853098be1a1c10ffe02a6245) (26-06-2026)

### Deprecated

- Bump checkout/upload-artifact to v5 to drop Node 20 deprecation _(actions)_ [4c5066f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/4c5066f5f4022873051fdfdfbd2984367b84b3d1) (29-06-2026)
- Bump TypeScript to 6.0 to accept ignoreDeprecations 6.0 _(manager-api)_ [42e42f7](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/42e42f78a3f29d6297151128f8e9b3a205152846) (27-06-2026)

### Fixed

- fix(ui): domain creation form's fields no longer misalign when the quota field's error line appears -- `items-end` bottom-aligned the row, so an error message only shown under quota pushed every other field's content down relative to it; switched to `items-start` so all fields stay flush at the top of the row regardless (08-07-2026)
- fix(ui): `ConfirmModal`'s click-to-confirm mode could fire `confirm` twice when spam-clicking -- `update:open(false)` doesn't remove the button from the DOM instantly, so a click landing in that window re-triggered the threshold check; now guarded (extra clicks past the 10th are a no-op) and the button disables once reached (08-07-2026)
- fix(ui): close the mobile sidebar overlay on every navigation instead of leaving it stuck open -- `USidebar` switches to a slideover under 1024px but doesn't close itself on nav clicks; watches the route and force-closes only below that breakpoint, so desktop's icon-rail collapse behavior is untouched (08-07-2026)
- fix(ui): truncate long group descriptions instead of overflowing the table horizontally (08-07-2026)
- fix(api,ui): stop `sieve_reject_senders.created_at` from auto-updating on every change; add a proper `updated_at` column instead (backfilled to each row's own `created_at`, not the migration's run time) and show it as its own column/field on the Sieve blocklist page (07-07-2026)
- fix(ui): avoid a Vue patch crash when swapping Rspamd's stats card between skeleton and loaded state, and show the table loading bar during history reloads instead of only on first load (07-07-2026)
- fix(ui): sidebar navigation item stays highlighted for any nested route under it, not just an exact path match (06-07-2026)
- fix(husky): pre-push checks never run when pushing main, unaffected on every other branch (06-07-2026)
- Domain rspamd card shows recipient address instead of sender _(ui)_ [09f8b60](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/09f8b6068370c66a998dcac8a54d5bdacac2522d) (01-07-2026)
- Explicit Ref type in provideBreadcrumb, replace non-null injection assert _(ui)_ [99b052b](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/99b052b2a3fb8112232c8f48a91a1b10db02efb5) (01-07-2026)
- Wrap onClick handlers in void-returning arrow functions to satisfy vue-tsc _(ui)_ [9228556](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/9228556f51a6dfe8a40b7854bc4a1447548c6e1c) (01-07-2026)
- Pin rspamd hostname to preserve Redis history keys across restarts _(infra)_ [bf3671b](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/bf3671b8d3a99da3ed282687f1a714ac2222cd7d) (01-07-2026)
- Lowercase domain before sidecar call, enforce single key on rotate _(dkim)_ [f043ba2](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/f043ba2a4b655f251cf0198f8cc84e1057522e3c) (01-07-2026)
- History_redis config, message-id field mapping, domain filter, dedicated UI page _(rspamd)_ [d7cc669](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d7cc669f321cc5ce755505ee3e37901ed80d3a9b) (01-07-2026)
- Pre-push hook reads pushed commits range from git stdin _(dev)_ [e42f78f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e42f78f8fa915ce7e5884ff98d8796c770d823c7) (01-07-2026)
- Reorder ref before reactive to satisfy define-macros-order lint rule _(ui)_ [e47a90a](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e47a90af91701b779e31aab5352504871565c9f5) (01-07-2026)
- Strip dead vue-router volar sfc-route-blocks plugin from tsconfig _(ui)_ [827e775](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/827e7757252d86639d72e690a9c50d03aad4692c) (30-06-2026)
- Wrap inviteOpen assignment in arrow fn to satisfy onClick void type _(ui)_ [14a69cb](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/14a69cbd5cc8c2d16e28cce065925cb530c17445) (30-06-2026)
- Uppercase AUTOROUTER to satisfy hygiene test _(changelog)_ [a3e542c](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/a3e542c8a6a4b11a052e2ef5545aa5c63f57674a) (30-06-2026)
- Resolve all lint and typecheck violations for CI pipeline _(manager-ui)_ [46a2110](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/46a2110d17e185b906c390e81c0e3077bb9a2d43) (30-06-2026)
- Align CI seed + test suite with current schema and stack behavior _(ci,tests)_ [9965428](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/996542861ed17f06142c2852ffc137d425a1f3d1) (30-06-2026)
- Refresh expired JWT on 401 and stop proxying /api/_nuxt_icon _(manager-ui)_ [c78b711](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/c78b7113e8b09928b39a9dc6e8b2989b438e27d5) (30-06-2026)
- Make roundcube optional, suite green on webmail-less stack _(tests)_ [583731b](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/583731beee40d65ee77ca9f0867d2584bded981f) (29-06-2026)
- Wait for postfix+dovecot logs to exist before booting _(fail2ban)_ [1a7dc2d](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1a7dc2d8e829f63e8cc64b757587512bf8d8c945) (29-06-2026)
- Drop first-mailbox provisioning and stop quota-row stacking _(mail)_ [dc1aaf3](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/dc1aaf3e19622971134e8a24eaea837c1960aaab) (28-06-2026)
- Reserve postmaster@<domain> as inactive write-only sender _(mail)_ [b4b59f6](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/b4b59f6097cf0891d78b2a7eb67efa6e6c8c72e3) (28-06-2026)
- Fail2ban sshd-ddos, postfix lmdb, log perms, drop fail2ban skip _(mail)_ [b6336d6](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/b6336d6f7ff5dc16d8abd3132ecff9a9b2f91cf5) (28-06-2026)
- Bake dhparam at build time so cold start never trips the healthcheck _(dovecot)_ [1bbc7ae](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1bbc7aeb253b9e3fc164d4f9255b30af5c4ecc41) (28-06-2026)
- Enable readline editing on every prompt _(install)_ [9724a30](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/9724a309ce20a458251e4d1fa5b2a11712689312) (28-06-2026)
- Wrap DKIM TXT value in double quotes in INSTALL_INFO.txt _(install)_ [bd23ac3](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/bd23ac3c68101f8beeb56cbb26db1522c9f597ba) (28-06-2026)
- Handle Let's Encrypt rotation inside postfix and dovecot containers (inotify watcher, no host install) _(tls)_ [fd9eb64](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/fd9eb64f31d1f363cc842252281a4d5fce0acee3) (27-06-2026)
- Parse DKIM sidecar response with python3 instead of grep, emit compact JSON server-side _(install)_ [06014a5](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/06014a519f9b6304fa38b07f86defe03c069d380) (27-06-2026)
- Route reject/redirect/vacation bounces through a milter-free internal postfix port _(sieve)_ [08ffc5b](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/08ffc5bf968add582b60337319ffe169a559df63) (27-06-2026)

### Security

- Fail2ban host-net jails for postfix and dovecot _(security)_ [5a927a1](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/5a927a1bfd2ff6ddb27fc1d61079b9370c6c9fc0) (27-06-2026)

## [1.1.7] - 2025-09-24

### Changed

- Merge branch 'hotfix/1.1.7' [45e0400](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/45e04001c90abdf0a4db3ab4903471cf48c5d90c) (24-09-2025)
- Hotfix v1.1.7 [0b8b2f6](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/0b8b2f6f5578763043386aa7d38c8fc106047326) (24-09-2025)

## [1.1.5] - 2025-02-07

### Changed

- Merge branch 'hotfix/v1.1.5' [d2f1217](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d2f1217876453959c794ef6ee5135791d567be0f) (07-02-2025)

### Fixed

- Records SASL Login failed from postfix only if it has a domain _(fail2ban)_ [990fb28](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/990fb2823d6249795f2a5d6bf5aafdfc6bf5f154) (07-02-2025)

## [1.1.4] - 2025-02-07

### Changed

- Merge branch 'hotfix/v1.1.4' [ea4077c](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ea4077c452e58db92ce71743eedf2e6da6e92486) (07-02-2025)

### Fixed

- Supports 3 auth worker messages [2ba848f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2ba848fb6f150382cb6d1fa73f005f155b67198a) (07-02-2025)
- Increase test time for postfix rules _(fail2ban)_ [2d9f116](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2d9f116b54f3ef316d8a5c0760643dd171a115b8) (07-02-2025)
- Excessive auth failed on legitimate connections [5d6e5bb](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/5d6e5bbb75c44ab93efff309a084d2f2bcf7346e) (07-02-2025)

## [1.1.3] - 2025-02-06

### Changed

- Merge branch 'hotfix/v1.1.3' [1c9b1dd](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1c9b1dd681931ac03b0ed52bac0d723ee57a0710) (06-02-2025)

### Fixed

- Allow no tls connections [9f02f4c](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/9f02f4cf43c40e78abafbb15f33a385925f3e632) (06-02-2025)

## [1.1.2] - 2025-01-31

### Changed

- Merge branch 'bugfix/v1.1.2' into develop [1b26447](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1b26447dcbe3754335dd290a0a903f89b597e389) (31-01-2025)
- Logs are now in true realtime in menu script [9f6e17f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/9f6e17fb7fdd80251f801eb1411d45ad1e4afa0f) (31-01-2025)
- Add a category refactor to changelog [9456de2](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/9456de2da5d83a53e637204bf3526471b5954826) (31-01-2025)
- Merge tag 'v1.1.1' into develop [bf46bbd](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/bf46bbdcda4c8158089444ec133e81e49d4060f0) (27-01-2025)

### Fixed

- Reduces the risk of server crashes due to the antivirus consuming too many resources on a server with too low a memory capacity [eabb9ab](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/eabb9abb8a71815206978b790352c8d11b96e7b3) (31-01-2025)
- Removes the ban from log legitime on postfix _(fail2ban)_ [e802513](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e80251376a886269ae12cc94e51c51c4448ca10c) (27-01-2025)

## [1.1.1] - 2025-01-27

### Changed

- Merge branch 'hotfix/v1.1.1' [5dccb20](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/5dccb20bb628ea2103a8d1ae2403085c5a9aca68) (27-01-2025)
- Adds a menu for complete management, installation and configuration of the docker mail server with ease and simplicity [03d5279](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/03d52792b0663cf28ad1dd9783ac2dd156b20b96) (26-01-2025)

### Fixed

- Prevents bots from polluting logs with failed connection attempts _(fail2ban)_ [b0afffa](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/b0afffab924942db19db9f6be1c28d7d5f77f615) (27-01-2025)
- Provides the possibility of rejection or acceptation of dmarc evaluation failures, by default to false (before set to true) _(opendmarc)_ [3502328](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/350232881a67950b83a875ed9afd33a9fa11d67b) (27-01-2025)
- Adds recursive to copy fail2ban conf folder [722015a](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/722015a633969c7511c68dd183b946e5b54378ba) (27-01-2025)
- Add custom postfix fail2ban filter [f452c19](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/f452c19e98ab32a0c0bcff1291ff715bbac0954a) (27-01-2025)
- Disable rspamd/greylist causing milter-reject 4.7.1 Try again later on some mails [8ba3637](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8ba363704571cde526f26330e1fc6dd7df411419) (27-01-2025)

## [1.1.0] - 2025-01-26

### Added

- Adds MultipleSignatures and MustBeSigned configuration to the menu _(menu/opendkim)_ [37b9a14](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/37b9a14fd967b733e779c844c5195bd3189eb5b9) (26-01-2025)
- Menu implementation for local server installation, configuration and management [71c0c12](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/71c0c123aeada32099c74731e521f4da354e3484) (26-01-2025)
- Adds menu for configuration, management and installation [fe3e030](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/fe3e030ee2b2434362cc117dc90c394b373ed1dd) (26-01-2025)
- Adds menu for configuration, management and installation [8ab4504](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8ab450467b4c4482c0009db3aa2e7d9af0b1d9df) (26-01-2025)

### Changed

- Adds a menu for complete management, installation and configuration of the docker mail server with ease and simplicity [ed56269](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ed56269618d06e4fc6fa6c75160389d5f31ebbdf) (26-01-2025)
- Merge branch 'feature/server-management-menu' of https://github.com/padcmoi/simply-a-dockerized-mail-server into feature/server-management-menu [d4a3aa1](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d4a3aa19aa7366e92fafbbc8467924bb10a04487) (26-01-2025)

### Fixed

- If an incoming mail has been sent by a misconfigured mail server that doesn't sign with dkim, the default server policy is to refuse, this commit allows you to set the choice to the administrator with a default value of no _(opendkim)_ [d9c863e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d9c863eba716f36abbf448d0301468048e0a024d) (26-01-2025)

## [1.0.1] - 2025-01-26

### Fixed

- If an incoming mail has been sent by a misconfigured mail server that doesn't sign with dkim, the default server policy is to refuse, this commit allows you to set the choice to the administrator with a default value of no _(opendkim)_ [7c202bb](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/7c202bbc7fa18a3ff222c35ca4da9f63bbd31969) (26-01-2025)
- If an incoming mail has been sent by a misconfigured mail server that doesn't sign with dkim, the default server policy is to refuse, this commit allows you to set the choice to the administrator with a default value of no _(opendkim)_ [c69a083](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/c69a083a9aa775a604367a9e6171e1b02947cb59) (26-01-2025)

## [1.0.0] - 2025-01-26

### Added

- Postfix log file in dedicated file or syslog [b09e21e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/b09e21edeebfcea30d740aa1951e2ef08e3db439) (18-01-2025)
- Customize the path where volumes will be stored [6e4acea](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/6e4acea0df656f1c10056bb62d0b88ec4ea52827) (17-01-2025)
- Adds the ability to enable e-mailing of dmarc reports [b449f7d](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/b449f7dfc5ab652e695cffb0319f14a7705f6db2) (16-01-2025)
- Add network utility [c73a0ed](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/c73a0edaf0b2109b0c59b705bcaa5bece47540b1) (13-01-2025)
- Implementation complete of opendmarc, default setup, cron added [67bc614](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/67bc6142c23fc9551770a8d8b0a30eaf9e2888ba) (13-01-2025)
- Add utility reusable [8c4e86c](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8c4e86c536fb8690414ccf0cd516cc280e1f4937) (13-01-2025)
- Add dmarc report for opendmarc, add a new volume [d61e5f9](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d61e5f998fdb848f80623639b6ad220a76deece0) (13-01-2025)
- Add opendmarc with configuration [24dfd76](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/24dfd76568811756db83bd1575670e63c1787705) (13-01-2025)
- Add dmarc configuration with rspamd, disable dkim in rspamd [f3201bd](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/f3201bde61af2456137883d14bd5795bdc71481e) (12-01-2025)
- Copies volumes during docker build and renames them in a temporary folder, then reinjects them when the container is launched [2077d7a](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2077d7a2f4231208e2aa31c6863809a4496c14ed) (09-01-2025)

### Changed

- Add firewall rules with ufw and add a basic config [d7d9fc5](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d7d9fc59bf41498c20b52679f2dc37b068decb9a) (17-01-2025)
- Cleans up architecture for easier upgrades [8e2a6f9](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8e2a6f92f079b9f1931a739b1db3ee1a7f5eb3ce) (17-01-2025)
- Moves docker folder to root folder [c04d1bd](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/c04d1bdefe2e8b8e32014ce73ecb058b91c8e961) (17-01-2025)
- Remove stdout 1 to avoid polluting with target mails root@domainFQDN [efef5e2](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/efef5e200ae40d59ce7b5fffce9842ee104e49bf) (17-01-2025)
- Change ambiguous system password [4e09e82](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/4e09e82b8c729e0243ad3edf7e29c5e9d4197578) (16-01-2025)
- Update title [6e736c7](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/6e736c7b73a22226f1c23bc985b43da425a3ad60) (16-01-2025)
- Missing reports at 0h [0a47651](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/0a47651c02b890972ef617e31ddbdd4378c4d26f) (16-01-2025)
- Update datetime file, file constantly modified [1e6fc2a](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1e6fc2ad1d76ddd557c739e150ae0ffe1d3f2472) (16-01-2025)
- Merge pull request #13 from padcmoi/debian11-bullseye [cc6a79d](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/cc6a79d6a0e7fae2141a1b56658644ce3576236a) (15-01-2025)
- Merge pull request #12 from padcmoi/bugfix/mail-server [442127b](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/442127b0ad6ed529baca5b616088e4bb5c3575ce) (15-01-2025)
- Enable SSL mode for phpmyadmin [205e966](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/205e9669643cab60b9e23a1dbf8727589bca2c04) (15-01-2025)
- Fix sql search sql to conf [bbbaac1](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/bbbaac122d146ddde39329361e6b0b52a13feaa2) (15-01-2025)
- Install roundcube in the image build, to solve the problem of creating databases from APT, add a SQL dump file [3aec3a9](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/3aec3a905ee5fe1fd7dc1a7a62b78b7770f2b485) (15-01-2025)
- Dmarc report script didn't work (overwrite) [911b443](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/911b44331a7b6e185de101f7f2799cae9e3b2b17) (15-01-2025)
- Dmarc report script didn't work [a8cb981](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/a8cb9810f0e4c5a614b5436c1dcae8095e0d246b) (15-01-2025)
- Remove useless mysql command [1c54fd8](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1c54fd83dd3d2f71731e50396c2a87f48ff0b23e) (15-01-2025)
- Rfc complete ll command [863e01a](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/863e01aa991ae72068c767e7ce0b42b93ec2866f) (15-01-2025)
- Install opendmarc in the image build, to solve the problem of creating databases from APT, add a SQL dump file [138a4be](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/138a4be4481ef69aad28dafdab2ae1843fb62d2b) (15-01-2025)
- Check_policy_service doesn't seem to accept multiple servers, already used by policy-spf [1284dce](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1284dce268bc35f4370ab3dc31b745102920c368) (14-01-2025)
- Move sample config in parent folder [fb2c50b](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/fb2c50b80089dc2b92b73ccf7724630c1c6a2f81) (14-01-2025)
- Improves the visual appearance of started services [8a73452](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8a734522cb0b970e67bb24c3c93a4b0ede5cc187) (14-01-2025)
- Improve network command [d60ce7c](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d60ce7c76bb47dcbc988f5dc659eee5ec0a40936) (13-01-2025)
- Remove duplicate roundcube configuration in apache.conf, this configuration file becomes a site available to activate [8df7841](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8df78416c321740b3459de1415c941f7548b520a) (13-01-2025)
- Fix, show state services [4277241](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/4277241f7564e84812b7fcb9c92cf99e19207f0b) (13-01-2025)
- Move services in each setup script, add default configuration to have functional services [6ca228d](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/6ca228d6b07adaf8d07d00892338712086436d44) (13-01-2025)
- Adds run after container in the docker setup sequence [162dd08](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/162dd0870e662786f288057a889bf1b60a3dcfe3) (13-01-2025)
- Merge pull request #5 from padcmoi/feature/e-mail-transfer-policy-dmarc [ed85dd7](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ed85dd7515c2e743b582be6fc9e9cef82677d59d) (13-01-2025)
- Connections to postfix milter [d24b0cb](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d24b0cbe8dc33a74b464c137a6474797bfbd7973) (13-01-2025)
- Remove duplicate element [def5cdd](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/def5cdd34643dd8046af787079ef831b0a68af27) (12-01-2025)
- Merge branch 'trunk' into feature/e-mail-transfer-policy-dmarc [d8015aa](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d8015aa4f15b3608b5bfa6f10c1abd1e3b034314) (11-01-2025)
- Remove the clear command, for better observation [de940a4](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/de940a4d94583b0479ecfada2052489b502ace41) (11-01-2025)
- Dovecot permissions issues on etc folder [01c22e0](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/01c22e02c135ede81594229714efe8be8af70072) (10-01-2025)
- Disable roundcube installation temp [b0ac7d2](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/b0ac7d2f630ed938ef57bb276114d8158ba99845) (10-01-2025)
- Fix cp after build database [d0197b4](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d0197b40487cd5808762044f8ffd5c6d42a044d1) (10-01-2025)
- Doesnt work [7e753af](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/7e753afaa5fd14d85a78978343e3c637e1bef221) (10-01-2025)
- Merge branch 'trunk' into feature/e-mail-transfer-policy-dmarc [e1b03ce](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e1b03cee6888c8ad12eb624e79c5d8f51ca2001b) (09-01-2025)
- Merge [f933378](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/f93337818381ccb47e4702bd5208aacb69d958b9) (09-01-2025)
- Merge pull request #8 from padcmoi/chore/clean-architecture [6a2f461](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/6a2f46138b189ea6a8c3d22060e161a04b359d45) (09-01-2025)
- Force permission on opendkim keys folder [cf0d7a2](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/cf0d7a2a97003b2512b773fa11cc0f22b9313359) (09-01-2025)
- Remove some useless features [44c2d58](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/44c2d587cc237797e5fc17196156deff8eff3afe) (09-01-2025)
- Remove some useless features [4c587e6](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/4c587e6d3f3ecf9570373098878a24fd89be93c0) (09-01-2025)
- Rfc system file and configuration, packages are now created in the Docker image, allowing faster restart/startup. [434045d](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/434045de82732146149ce77bde1d941829468f64) (09-01-2025)
- Add original configuration as reference [3a4deb4](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/3a4deb4a5686e268e113802e6960b16e5ae9c591) (09-01-2025)
- Fix add template folder and removes useless instructions [d53d5f0](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d53d5f0f689ccef4c2f8514183a86ba559725399) (08-01-2025)
- Merge branch 'main' into feature/e-mail-transfer-policy-dmarc [768ee36](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/768ee3638b78d840821c83ef0f61255b8005b9ee) (07-01-2025)
- Check dmarc implementation [4bc24d7](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/4bc24d709da82470fe5c035dec33b920b440e64d) (07-01-2025)

### Fixed

- Add to environment the key data DMARC_REPORT_HOUR [e83bb10](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e83bb10242d5544da6e55828399a3a111ee7d501) (26-01-2025)
- Multiple bugs before prod [a20a2a5](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/a20a2a570287e64886a55efe7e4f80d59ff86018) (26-01-2025)
- To avoid fail2ban crashing if these logs dont exist [68f93a0](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/68f93a0c3cd1eb36d2396c33a0d1e3156cec0c4e) (13-01-2025)
- Change default dmarc [a1a457e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/a1a457eb2a496320ac9085e0ad65eb88eff9175e) (13-01-2025)
- Moves part dmarc in dedicated file [763d6da](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/763d6daa350506c41d64ca5dd78e3c369b647a81) (12-01-2025)
- Move apache2 concerning rspamd web in 24-rspamd [bf66609](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/bf6660943e4373b280cd394b927b4f0e700b386b) (11-01-2025)
- Opens a socket to allow applications to add content to the database during the image build [461ec3e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/461ec3e937a828552c45f2d280c524912a881712) (11-01-2025)
- Opens a socket to allow applications to add content to the database during the image build [8612c6f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8612c6f920584ba0c28302330cb740817c86a6bd) (11-01-2025)
- Separates phpmyadmin from the apache2 module as an optional module [002a6a8](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/002a6a8deca764504baf68a1904a5cd85e8a5563) (11-01-2025)
- Separates save spaces from folders destined to become docker volumes [237c204](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/237c204d37219f07427ff070d202206c17b22c48) (11-01-2025)
- Ambigous name password [a394aaa](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/a394aaa2f29ab0c04a86432f5d8e3f055f58c3b7) (09-01-2025)
- Issue of permissions on dkim keys once created [7ef64ed](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/7ef64ed992f95e02dec01f7dcc3f3d6a2192f625) (09-01-2025)
- Crash postfix boot, permission issues resolved [1ffa9db](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1ffa9db823675257dc1713d98060fbcbd380410f) (09-01-2025)
- Permissions on folders clamav, rspamd [dadd147](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/dadd147955a7c1e362f31eaab071e5d0a40e6be9) (09-01-2025)

## [0.1.0] - 2025-01-08

### Added

- Customizable jail rules [99d762c](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/99d762cde7d6df4446cd9cf2d7acafc15d44c9f2) (08-01-2025)
- Implement a firewall and fail2ban to combat brute force attacks [c582e13](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/c582e138ff68714ac755af16d3cb1ec0299898d5) (07-01-2025)
- Implementation SPF [ac44ffc](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ac44ffca5447090813d8febc58df4cd82dda9ef2) (06-01-2025)
- Implementation successful opendkim with antivirus ok [2f4b03f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2f4b03fad2645714a5eb5e5aae06dc3ce42b6c17) (06-01-2025)
- Add util command ll [1538caa](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1538caa9232be93011f56be858a49a2091972d16) (06-01-2025)
- Add spf rules [558f70f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/558f70f0c5ade13810af001b57ac48cefc50b7ee) (06-01-2025)
- Add notification on spam rejection [47fb1a6](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/47fb1a62bf896f8389fcc9eab5b5617eead071ec) (05-01-2025)
- Add clamav rules to rspamd [926b8ed](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/926b8ed3d46eb555219b01805d307e359ee3a13c) (05-01-2025)
- Persist clamav database [d9affeb](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d9affeb5bb5a31fd5801d09b897a02cedc9c2c7d) (05-01-2025)
- Persist config data from rspamd [bf59115](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/bf59115b6ec9bd522d9d8c547d6bf81e390e2153) (02-01-2025)
- Add spam flag with redirect in spam folder [9de63b3](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/9de63b3eea9fcde300af273d57167f184cd4ceb7) (02-01-2025)
- Persist redis data from rspamd [4666ab1](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/4666ab1bf40833990a75e91821f7471464a8366a) (01-01-2025)
- Implement rspamd web interface [00756d7](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/00756d7ead92e3bdcdc8cefcffbffa3483fe9965) (01-01-2025)
- Add custom virtual hosts for apache 2 & change access port [a484268](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/a484268b08c90643e14de249ece61e8d0ad8df48) (01-01-2025)
- Add rspamd with settings & implement Bayesian self-learning ham, spam in dovecot [ee7448a](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ee7448a3c8423db11ac2abadcf1fb55ada758f2b) (01-01-2025)
- Add update auto certificate script [ff71f4e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ff71f4e3e4f326e0f6871a5fe1f5c8773959a897) (30-12-2024)
- Implements the ability to enable or disable antivirus [ac89d21](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/ac89d21ed497c407feb9b4b435253c5d61780143) (28-12-2024)
- Add postfix volume [f765b63](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/f765b63595903f854fdeadfe2fca3f50314f4236) (28-12-2024)
- Add task cron, refresh antivirus [bd63796](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/bd637963d67e38a486b8273e12718ecfd7b65d68) (28-12-2024)
- Add sieve rules [23e97de](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/23e97de6bf23e53e27914602086449d1fd52c2a9) (27-12-2024)
- Add roundcube webmail with basic configuration [e199da6](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e199da659c92c1e6fc4dbe6d06736aca89fcef0b) (27-12-2024)
- Adds functional container with postfix, dovecot, database and configuration [585880b](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/585880ba1ed2104f73e2ba6d67251962830b6c24) (25-12-2024)
- Separate dockerfiles in dedicated folder && import repository in docker container [73a2a3f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/73a2a3f4016efd111037a0a54eb2392b4a800fda) (17-12-2024)
- Add environnement file at nest api [b71d069](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/b71d069b931bea4ed719a61675fe2b5b67b3225e) (17-12-2024)

### Changed

- Check fail2ban implementation [8663cd2](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8663cd28a7c6962e97e3c735917c200ef9f62527) (07-01-2025)
- Merge pull request #4 from padcmoi/feature/sign-with-opendkim [bd4da71](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/bd4da71ea3ef9bfeb736d3975609504caeda4169) (07-01-2025)
- Fix attempt fix mysql error log [93d389f](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/93d389fb481c4d8333318957a28719cd85e549fb) (07-01-2025)
- Merge branch 'main' into feature/sign-with-opendkim [430d5f9](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/430d5f98b84faad829f7eff4b5d42617f8263be7) (06-01-2025)
- Merge branch 'main' into feature/sign-with-opendkim [589b712](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/589b7122df6615b0d8eeab027b65806fe1bf496f) (06-01-2025)
- Disable logs mysql server [f7767ab](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/f7767ab4798ced9cf6d79d33c4b25083674a4394) (06-01-2025)
- Also provides a nice, ready-to-use public key file for sending to DNS [98e6de6](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/98e6de661445ec8f7a500954ec00111037033766) (06-01-2025)
- Check opendkim [1b26895](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1b2689582573f8bad60ddb8e95a0345eb96a2894) (05-01-2025)
- Fix api details [11a7f92](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/11a7f9252091c6dfb74756433379bc0f10624688) (05-01-2025)
- Disable API instruction (no create) to reduce build time [d47ce15](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d47ce154c5e7cf3217e41441989084a35e45ee3f) (05-01-2025)
- Merge pull request #3 from padcmoi/feature/migrate-antivirus-filtering-from-amavis-to-rspam [fbd8206](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/fbd8206af499c5f4816b0a7713909db1d5406474) (05-01-2025)
- Remove old amavis [2e12c88](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2e12c88c906e2e69e7d3e054be55449b678bf17a) (05-01-2025)
- Remove useless old mail daemon and add tool [b01b3ad](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/b01b3ad875ba8de90b43ffc1904a536cbb1a5d08) (05-01-2025)
- Update spam module readme [793cfbe](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/793cfbebcb3254ce5869b1a88b6dc7ebf4c887a1) (03-01-2025)
- Update modules added, rspam, postscreen [89edc07](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/89edc0754517c034d4c9d10da741806a33961fd5) (03-01-2025)
- Merge pull request #1 from padcmoi/feat/spam-implementation [929b9e1](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/929b9e134011c115be04eaceee3fa28c8335c2b7) (03-01-2025)
- Fix postscreen volume lost after diff merge [d8cd1e7](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/d8cd1e70a2a00aebce32bed4721f364ef42e9ead) (31-12-2024)
- Resolve conflict from main branch [2f76f66](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2f76f66bc4c283365b437d528295345e201c7a5d) (31-12-2024)
- Move volumes folder to the root project [7191071](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/71910719ef76e5940cf88b0cb4be3dfe946c79ee) (31-12-2024)
- Feat; implement postscreen [a782c46](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/a782c462f26cc11b718a4a97331d786a17987f00) (31-12-2024)
- Merge branch 'main' into feat/spam-implementation [7ff6287](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/7ff62878087c294a5911436c344954c4d09785e7) (30-12-2024)
- Merge branch 'main' into feat/spam-implementation [8719b39](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8719b39ca29c988d89fd2c8c8d8eebf3c6a71deb) (28-12-2024)
- Init rspam implement [3778de7](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/3778de77ceee5fe26ab27f3d08e56e7b0ae92b7b) (28-12-2024)
- Add license [1eebe61](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/1eebe6176e444fb9474ea5310e67441ec7071681) (17-12-2024)
- Create README.md [2ba1668](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/2ba1668e1ee96c5143ca4f069812ae376a3ae4d7) (17-12-2024)
- Initial commit [bf0942e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/bf0942e282278c9ed1805b8dbdd15aaf0edccd7b) (17-12-2024)

### Fixed

- Transfer fail2ban log to syslog, notify ban & unban [577f6c5](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/577f6c51759d4201419a785d919da47f41572f60) (08-01-2025)
- Remove mysql log from syslog and move warn mysql log in dedicated file [5cbf86d](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/5cbf86dbac985349269344bab0b756dae9402088) (07-01-2025)
- Add roundcube table to mailuser mysql user [5f177f8](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/5f177f8af10bce0f6d1d1163438b208ea3d77ceb) (06-01-2025)
- Syslog missing [e12ae24](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e12ae2481c2eb05bea1b856af5606e3782acb161) (03-01-2025)
- Chown errors with unknow vmail user and group [170bc1c](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/170bc1c909eb2342b51b3b04d89f0f28b71421b0) (02-01-2025)
- Default sieve rules to new user [80ec596](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/80ec59611d2753d6af3dd600131bb789396a35b8) (02-01-2025)
- Enable upstream spam flag [8499858](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8499858f3c09163e9f3fb100ca2bc7d9108c391e) (01-01-2025)
- Add whistlist ip to postscreen [e6b0c9d](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/e6b0c9dd2d28d15381cb1e7f5a4fdb2f8d4806f4) (01-01-2025)
- Sql tables numeric values with bigint [be7ee6e](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/be7ee6e0ce9cfa9583c74c821e1f1e28f99d14e8) (30-12-2024)
- Roundcube adress imap, smtp server [7c04c92](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/7c04c92214151ed4542274b60c6294645026f112) (30-12-2024)
- Disable IPV6 & restrictions rules & spamd missing conf [8cc7bee](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/8cc7bee5ad263b3419bca305260e32079a4a750b) (29-12-2024)
- Sieve error on recipient autoresponses [fde84e5](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/fde84e5a62830b51c3a07fb6c1741dfdc17bdb19) (27-12-2024)
- Hostname ambigous key by fqdn_domain [5f8e6e4](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/5f8e6e4d6cde11d4daac02c1da48e6d13b6590f6) (27-12-2024)
- Provide start ssl cert [94044bf](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/94044bf4c8febf54fd96a616a873349bb004d36b) (25-12-2024)

### Security

- Merge pull request #6 from padcmoi/feature/security-fail2ban-firewall [95fb1eb](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/95fb1eb08c566d6cda35935ef86dd09832480d5e) (08-01-2025)
- Merge branch 'main' into feature/security-fail2ban-firewall [3159e57](https://github.com/padcmoi/simply-a-dockerized-mail-server/commit/3159e5743ec55587645e5af9f0c8cff7ba906476) (07-01-2025)
[unreleased]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/1.1.7...HEAD
[1.1.7]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v1.1.5...1.1.7
[1.1.5]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v1.1.4...v1.1.5
[1.1.4]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/padcmoi/simply-a-dockerized-mail-server/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/padcmoi/simply-a-dockerized-mail-server/releases/tag/v0.1.0
