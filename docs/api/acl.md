# ACL: resources, actions, and the permission every API route requires

manager-api authorizes every request through
[`@naskot/custom-permission-guard`](../../manager-api/src/core/custom-permission-guard/custom-permission-guard.service.ts).
Permissions are granted to **groups**, accounts belong to zero or more groups, and
a permission is a `(resource, action)` pair, scoped either globally or to a single
domain.

There are no generic CRUD actions. `read`, `create`, `modify` and `delete` are gone
from the vocabulary: each resource declares the actions it actually offers, named
after the capability they open, in
[`permission-catalog.ts`](../../manager-api/src/core/custom-permission-guard/permission-catalog.ts).
`superadmin:read` meant nothing; `groups:modify` covered both renaming a group and
rewriting every permission on the server.

**Every route that acts on a resource carries at least one named action.** The nine
exceptions are listed after the table: authentication itself, the liveness probe, the
caller's own profile, and the two invitation routes where the token is the credential.

> The route table below is **generated** from the controllers' decorators. If it ever
> disagrees with the code, the table is wrong.

## The rules that apply everywhere

- **`access` is an implicit prerequisite.** The guard library requires `access` on a
  resource before any of its named actions (`assert.ts`, `requiredActionsFor`). A
  `recipients:create-recipient` row without `recipients:access` grants nothing. Routes
  still spell `access` out, so a decorator states the full truth of what it demands.
- **Everything is conjunctive.** Decorator entries are ANDed, and so are the actions
  inside one entry. A single missing pair refuses the route.
- **A root account bypasses all of it.** Root belongs to no group and holds no
  permission rows; both guards let it through *before* the library is ever consulted.
  Root is a bypass, never a gate, which is why no route is "root only" any more.
- **A domain's owner is root on that domain, and nowhere else.** The library grants a
  domain owner every action of every domain-tier resource on the domains they own
  (`findOwnedDomainIds`), with no rows at all. There is deliberately no such bypass at
  the global tier. That is the lever used to withhold a handful of actions from an owner
  over their own domain: gate them on a **global** resource the ownership bypass cannot
  reach, so the owner must be granted them explicitly (or be a full root account).
  - `global:superadmin` withholds `resize-any-domain-quota` and `delete-any-domain`.
  - `global:domain_owner_elevated` withholds `delete-dkim-key` and
    `transfer-domain-ownership`. Both routes still carry their domain-tier action, which
    the owner passes for free; the extra global action is the part they must hold. Without
    it, even the owner is refused these two operations.
- **`domains:<action>` (global) bridges to `domain:<action>` on ANY domainId**
  (`bridgeFromGlobal`). The action name is forwarded verbatim, so `GLOBAL_ACTIONS.domains`
  must be a superset of `DOMAIN_ACTIONS.domain`. `assertBridgeIsSound()` fails the boot
  and names the missing action rather than letting the first request 500.

## The action catalog

### Global tier

| Resource | Named actions (besides `access`) |
|---|---|
| `sieve` | `list-reject-senders`, `create-reject-sender`, `edit-reject-sender`, `delete-reject-sender` |
| `rspamd` | `view-rspamd-stats`, `view-rspamd-history`, `view-rspamd-thresholds`, `edit-rspamd-thresholds`, `reset-rspamd-thresholds` |
| `postfix` | `view-postfix-queue` |
| `accounts` | `list-account-names`, `list-accounts`, `view-account`, `edit-account`, `revoke-account`, `invite-account` |
| `api-tokens` | `list-api-tokens`, `create-api-token`, `edit-api-token`, `revoke-api-token`, `regenerate-api-token`, `delete-api-token` |
| `groups` | `list-groups`, `view-group`, `list-group-members`, `create-group`, `edit-group`, `edit-group-global-permissions`, `edit-group-domain-permissions`, `delete-group`, `transfer-group-ownership`, `add-group-member`, `remove-group-member` |
| `domains` | `list-all-domains`, `view-disk-usage`, `create-domain`, `view-domain`, `toggle-domain-active`, `transfer-domain-ownership` |
| `supervision` | `view-machine-metrics`, `view-metrics-history` |
| `superadmin` | `resize-any-domain-quota`, `delete-any-domain` |
| `domain_owner_elevated` | `delete-dkim-key`, `transfer-domain-ownership` |

### Domain tier

| Resource | Named actions (besides `access`) |
|---|---|
| `domain` | `view-domain`, `toggle-domain-active`, `transfer-domain-ownership` |
| `recipients` | `list-recipients`, `view-recipient`, `view-recipient-headroom`, `create-recipient`, `edit-recipient`, `delete-recipient` |
| `aliases` | `list-aliases`, `view-alias`, `create-alias`, `edit-alias`, `delete-alias` |
| `quotas` | `view-quotas` |
| `rspamd` | `view-rspamd-stats`, `view-rspamd-history` |
| `admin` | `view-admin-page`, `toggle-domain-active`, `manage-dkim` |
| `dkim` | `view-dkim`, `check-dkim-dns`, `rotate-dkim-key`, `delete-dkim-key` |

## Resource dependencies (`dependsOn`)

An extra lock, never a shortcut: the dependency must be granted as well, otherwise the
dependent resource is refused without even being evaluated.

| Resource | Also requires |
|---|---|
| `global:groups` | `global:accounts` [access, list-account-names] |
| `global:superadmin` | every other global resource, with **all** of its actions |
| `domain:recipients` | `domain:domain` [access] |
| `domain:aliases` | `domain:domain` [access] |
| `domain:quotas` | `domain:domain` [access] |
| `domain:rspamd` | `domain:domain` [access] |
| `domain:admin` | `domain:domain` [access] |
| `domain:dkim` | `domain:domain` [access] **and** `domain:admin` [access, view-admin-page] |

Managing groups means naming their members, which means reading account **names**
(`GET /accounts/names`), not the full list with emails and roles. Hence
`list-account-names` rather than `list-accounts`.

Ticking `superadmin:access` grants the whole server, because `superadmin` depends on
every other global resource with all of its actions, and the UI grants a checked
resource's dependencies along with it.

## Anti-lockout

`lockoutProtected` refuses any write that would leave zero groups holding
`groups:access` + `groups:edit-group-global-permissions`. Renaming a group has never
rescued anyone from a lockout, which is why `edit-group` is not the protected action.
Root is exempt (`rawSetGroupGlobalPermissions`).

## Routes

| Method | Route | Required permissions |
|---|---|---|
| `GET` | `/accounts` | `global:accounts` [access, list-accounts] |
| `GET` | `/accounts/:id` | `global:accounts` [access, view-account] |
| `PATCH` | `/accounts/:id` | `global:accounts` [access, edit-account] |
| `DELETE` | `/accounts/:id` | `global:accounts` [access, revoke-account] |
| `POST` | `/accounts/invite` | `global:accounts` [access, invite-account] |
| `GET` | `/accounts/invite/:token` | _public: the invitation token IS the credential_ |
| `POST` | `/accounts/invite/:token/accept` | _public: the invitation token IS the credential_ |
| `GET` | `/accounts/names` | `global:accounts` [access, list-account-names] |
| `DELETE` | `/admin/domains/:domainId` | `global:domains` [access] **AND** `global:superadmin` [access, delete-any-domain] |
| `PATCH` | `/admin/domains/:domainId/quota` | `global:domains` [access] **AND** `global:superadmin` [access, resize-any-domain-quota] |
| `GET` | `/api-tokens` | `global:api-tokens` [access, list-api-tokens] |
| `POST` | `/api-tokens` | `global:api-tokens` [access, create-api-token] |
| `PATCH` | `/api-tokens/:id` | `global:api-tokens` [access, edit-api-token] |
| `DELETE` | `/api-tokens/:id` | `global:api-tokens` [access, delete-api-token] |
| `POST` | `/api-tokens/:id/regenerate` | `global:api-tokens` [access, regenerate-api-token] |
| `POST` | `/api-tokens/:id/revoke` | `global:api-tokens` [access, revoke-api-token] |
| `POST` | `/auth/jwt/login` | _no ACL: authentication itself_ |
| `POST` | `/auth/jwt/logout` | _no ACL: authentication itself_ |
| `GET` | `/auth/jwt/me` | _no ACL: the caller's own profile_ |
| `PATCH` | `/auth/jwt/me` | _no ACL: the caller's own profile_ |
| `GET` | `/auth/jwt/me/permissions` | _no ACL: the caller's own permissions_ |
| `POST` | `/auth/jwt/refresh` | _no ACL: authentication itself_ |
| `GET` | `/domains` | `global:domains` [access] |
| `POST` | `/domains` | `global:domains` [access, create-domain] |
| `GET` | `/domains/:domainId` | `domain:domain` [access, view-domain] |
| `PATCH` | `/domains/:domainId/active` | `domain:admin` [access, toggle-domain-active] **AND** `domain:domain` [access, toggle-domain-active] |
| `GET` | `/domains/:domainId/aliases` | `domain:aliases` [access, list-aliases] |
| `POST` | `/domains/:domainId/aliases` | `domain:aliases` [access, create-alias] |
| `GET` | `/domains/:domainId/aliases/:id` | `domain:aliases` [access, view-alias] |
| `PATCH` | `/domains/:domainId/aliases/:id` | `domain:aliases` [access, edit-alias] |
| `DELETE` | `/domains/:domainId/aliases/:id` | `domain:aliases` [access, delete-alias] |
| `GET` | `/domains/:domainId/dkim` | `domain:dkim` [access, view-dkim] **AND** `domain:admin` [access, view-admin-page] |
| `GET` | `/domains/:domainId/dkim-check` | `domain:dkim` [access, check-dkim-dns] **AND** `domain:admin` [access, view-admin-page] |
| `DELETE` | `/domains/:domainId/dkim/:selector` | `global:domain_owner_elevated` [access, delete-dkim-key] **AND** `domain:dkim` [access, delete-dkim-key] **AND** `domain:admin` [access, manage-dkim] |
| `POST` | `/domains/:domainId/dkim/rotate` | `domain:dkim` [access, rotate-dkim-key] **AND** `domain:admin` [access, manage-dkim] |
| `PATCH` | `/domains/:domainId/owner` | `global:domain_owner_elevated` [access, transfer-domain-ownership] **AND** `domain:domain` [access, transfer-domain-ownership] |
| `GET` | `/domains/:domainId/quotas` | `domain:quotas` [access, view-quotas] |
| `GET` | `/domains/:domainId/recipients` | `domain:recipients` [access, list-recipients] |
| `POST` | `/domains/:domainId/recipients` | `domain:recipients` [access, create-recipient] |
| `GET` | `/domains/:domainId/recipients/:id` | `domain:recipients` [access, view-recipient] |
| `PATCH` | `/domains/:domainId/recipients/:id` | `domain:recipients` [access, edit-recipient] |
| `DELETE` | `/domains/:domainId/recipients/:id` | `domain:recipients` [access, delete-recipient] |
| `GET` | `/domains/:domainId/recipients/headroom` | `domain:recipients` [access, view-recipient-headroom] |
| `GET` | `/domains/:domainId/rspamd/history` | `domain:rspamd` [access, view-rspamd-history] |
| `GET` | `/domains/:domainId/rspamd/stats` | `domain:rspamd` [access, view-rspamd-stats] |
| `GET` | `/domains/disk` | `global:domains` [access, view-disk-usage] |
| `GET` | `/groups` | `global:groups` [access, list-groups] |
| `POST` | `/groups` | `global:groups` [access, create-group] |
| `GET` | `/groups/:id` | `global:groups` [access, view-group] |
| `PATCH` | `/groups/:id` | `global:groups` [access, edit-group] |
| `DELETE` | `/groups/:id` | `global:groups` [access, delete-group] |
| `PUT` | `/groups/:id/domain-permissions` | `global:groups` [access, edit-group-domain-permissions] |
| `PUT` | `/groups/:id/global-permissions` | `global:groups` [access, edit-group-global-permissions] |
| `GET` | `/groups/:id/members` | `global:groups` [access, list-group-members] |
| `POST` | `/groups/:id/members` | `global:groups` [access, add-group-member] _(root **OR** the group's owner **OR** this action; enforced in `GroupsService`)_ |
| `DELETE` | `/groups/:id/members/:accountId` | `global:groups` [access, remove-group-member] _(root **OR** the group's owner **OR** this action; enforced in `GroupsService`)_ |
| `PATCH` | `/groups/:id/owner` | `global:groups` [access, transfer-group-ownership] _(root **OR** the group's owner **OR** this action; enforced in `GroupsService`)_ |
| `GET` | `/groups/permissions/catalog` | `global:groups` [access, view-group] |
| `GET` | `/health` | _no ACL: liveness probe_ |
| `GET` | `/postfix/queue` | `global:postfix` [access, view-postfix-queue] |
| `GET` | `/rspamd/actions` | `global:rspamd` [access, view-rspamd-thresholds] |
| `PATCH` | `/rspamd/actions` | `global:rspamd` [access, edit-rspamd-thresholds] |
| `DELETE` | `/rspamd/actions` | `global:rspamd` [access, reset-rspamd-thresholds] |
| `GET` | `/rspamd/history` | `global:rspamd` [access, view-rspamd-history] |
| `GET` | `/rspamd/stats` | `global:rspamd` [access, view-rspamd-stats] |
| `GET` | `/sieve/reject-senders` | `global:sieve` [access, list-reject-senders] |
| `GET` | `/supervision/live` | `global:supervision` [access, view-machine-metrics] |
| `GET` | `/supervision/history/:range` | `global:supervision` [access, view-metrics-history] |
| `POST` | `/sieve/reject-senders` | `global:sieve` [access, create-reject-sender] |
| `PATCH` | `/sieve/reject-senders/:id` | `global:sieve` [access, edit-reject-sender] |
| `DELETE` | `/sieve/reject-senders/:id` | `global:sieve` [access, delete-reject-sender] |

### The nine routes with no ACL, and why

`POST /auth/jwt/login`, `/refresh` and `/logout` are authentication itself: demanding a
permission to obtain a token makes no sense. `GET`/`PATCH /auth/jwt/me` and
`GET /auth/jwt/me/permissions` only ever return what belongs to the caller.
`GET /health` is a liveness probe. `GET /accounts/invite/:token` and
`POST /accounts/invite/:token/accept` are `@Public()` by construction: the invitee has
no account yet, and the invitation token **is** their credential.

## Why some actions are what they are

**`supervision` splits the live minute from the recorded month.** The two are not
the same reading: `view-machine-metrics` opens what the machine is doing now (the
live route and the websocket topic behind it, both fed by the same in-memory
window), while `view-metrics-history` opens a month of recorded samples, which is
a different question and a different table. Holding one grants nothing about the
other. How long that month is kept is not in this catalog at all: it is a
root-only `/config/**` setting, because a retention is a decision about the
server, not a reading of it.

**`rspamd` demanded `modify`+`delete` together, for two different routes.**
`PATCH /rspamd/actions` writes arbitrary thresholds, an unbounded power that can
silently break spam filtering server-wide. `DELETE /rspamd/actions` only ever restores
the baseline shipped with the project (`RSPAMD_FACTORY_ACTIONS`): a bounded, known
outcome. Hence `edit-rspamd-thresholds` and `reset-rspamd-thresholds`, so an operator
can hand out "restore the defaults" without handing out "tune the filter". The three
reads are distinguished too.

**`groups:modify` covered three powers**: renaming a group, rewriting its global
permissions, rewriting its domain permissions. Only the second is protected against
lockout.

**Three group routes are guarded by a disjunction.** `PATCH /groups/:id/owner`,
`POST /groups/:id/members` and `DELETE /groups/:id/members/:accountId` obey
"root **OR** the group's owner **OR** this action". A guard decorator can only AND
conditions, so declaring the action there would have taken the right away from the very
owners it was meant to leave alone. The rule lives in `GroupsService`, and the route
still declares its action through `@ServiceEnforcedGlobalPermissions`, purely so the
action stays typed against the catalog and shows up in the table above. The library
offers an ownership bypass for domains only (`findOwnedDomainIds`), never for groups.

**`PATCH /domains/:domainId/owner` is gated on two tiers.** `domain:transfer-domain-ownership`
is passed for free by the owner through the library's ownership bypass, so on its own it
would let any owner hand their domain away. The second decorator,
`global:domain_owner_elevated:transfer-domain-ownership`, is the real gate: the ownership
bypass cannot reach the global tier, so an account must be granted this global action (or
be a full root account) to transfer a domain. That is the deliberate carve-out described
under the ownership rule above.

**`superadmin:read` meant nothing.** It became `resize-any-domain-quota` and
`delete-any-domain`, the two powers a domain owner must never have over their own domain.

**`domain_owner_elevated` is the second owner carve-out.** Like `superadmin`, it is a global
resource whose only purpose is to withhold actions from a domain's owner that the domain
tier would otherwise grant for free. It holds `delete-dkim-key` and
`transfer-domain-ownership`: a "root on my domain" account needs these two global
permissions (or a full root account) to delete a DKIM key or hand the domain to someone
else. The ownership bypass still covers everything else on the domain, so the owner remains
self-sufficient for the day-to-day.

**DKIM: rotation is not deletion.** `POST /dkim/rotate` demanded `create`+`modify`+`delete`
together because it destroys every existing key before minting a new one. It is now
`rotate-dkim-key`. On the `admin` resource, both writes share `manage-dkim`. Deleting a key
outright is the one DKIM action an owner cannot self-serve: `DELETE /dkim/:selector` also
demands `global:domain_owner_elevated:delete-dkim-key`, because it can leave a domain with
no key at all and break outbound signing, whereas rotation always leaves a working key
behind. Rotation is therefore left to the owner; deletion is withheld.

**`domains:read` covered two things**: seeing every domain rather than one's own
(`list-all-domains`), and reading the volume's capacity (`view-disk-usage`).

**`/accounts` and `/api-tokens` used to guard nothing.** Every `/accounts` route but
`names` was root-only, which made the whole `accounts` resource inert: a group could hold
`accounts:read` and still be refused. `/api-tokens` had no permission guard at all. Both
now carry real actions. Root still passes everything, so nothing is opened by default;
what changes is that an administrator can delegate. Note the consequence for API tokens:
a non-root account now needs `api-tokens:*` to manage even its own tokens. Put those
actions in the default group if every account should keep that self-service.

**The sidebar only asks for `access`.** There is no generic `read` action any more, and a
nav helper that iterates resources cannot guess each one's listing action. So `access`
means exactly "this resource is visible to me", and the listing action gates the content
inside the page. That was already how `domains` behaved, as the one documented exception.

## Where the code lives

| Concern | File |
|---|---|
| The catalog: resources, actions, `dependsOn`, bridge assertion | [`permission-catalog.ts`](../../manager-api/src/core/custom-permission-guard/permission-catalog.ts) |
| Route decorators, typed per resource | [`require-permissions.decorator.ts`](../../manager-api/src/core/custom-permission-guard/require-permissions.decorator.ts) |
| Library wiring, `lockoutProtected`, root escape hatches | [`custom-permission-guard.service.ts`](../../manager-api/src/core/custom-permission-guard/custom-permission-guard.service.ts) |
| Root bypass, global tier | [`global-permission.guard.ts`](../../manager-api/src/core/custom-permission-guard/global-permission.guard.ts) |
| Root bypass, ownership, bridge, domain tier | [`domain-permission.guard.ts`](../../manager-api/src/core/custom-permission-guard/domain-permission.guard.ts) |
| Body validation, per-resource discriminated union | [`groups.validation.ts`](../../manager-api/src/api/groups/groups.validation.ts) |
| The catalog, served to clients | `GET /api/v1/groups/permissions/catalog` |

A requirement is a union with one branch per resource, so
`{ resource: "sieve", actions: ["delete-dkim-key"] }` is a compile error, and the Zod
schema behind `PUT /groups/:id/global-permissions` refuses the same pair at write time
rather than persisting a row the guard would later choke on.
