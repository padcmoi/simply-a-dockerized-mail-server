/**
 * ACL Catalog
 *
 * One entry per resource, listing the actions that resource actually offers.
 * Action names describe a real capability ("create-recipient"), never a generic
 * verb: `read` on `superadmin` meant nothing, and `modify` on `groups` covered
 * both renaming a group and rewriting its permissions, two powers of a wholly
 * different order.
 *
 * `access` is always the first action of every resource and is never optional:
 * @naskot/custom-permission-guard demands it implicitly for every other action
 * (see its assert.ts, `requiredActionsFor`), so a `create-recipient` row without
 * an `access` row grants nothing. It stays declared here because several routes
 * require `access` on its own, and the lib validates every requested action
 * against these rules.
 *
 * The domain-tier `domain` resource is bridged from the global `domains`
 * resource (bridgeFromGlobal, see custom-permission-guard.service.ts). The lib
 * forwards the action name verbatim to the global resource, so every action of
 * DOMAIN_ACTIONS.domain MUST also exist in GLOBAL_ACTIONS.domains, otherwise the
 * bridge throws a config error (an HTTP 500, not a 403). `assertBridgeIsSound`
 * below fails at boot rather than on the first request.
 */

export const GLOBAL_ACTIONS = {
  sieve: ["access", "list-reject-senders", "create-reject-sender", "edit-reject-sender", "delete-reject-sender"],
  rspamd: [
    "access",
    "view-rspamd-stats",
    "view-rspamd-history",
    "view-rspamd-thresholds",
    "edit-rspamd-thresholds",
    "reset-rspamd-thresholds",
  ],
  postfix: ["access", "view-postfix-queue"],
  // `list-account-names` guards GET /accounts/names, the trimmed-down list the
  // group member picker needs; `groups` depends on it for exactly that reason.
  // The heavier routes each carry their own action.
  // `view-account-sessions` covers reading a member's sessions, active AND
  // expired (one action, not two). `revoke-account-sessions` covers kicking one
  // or several of a member's sessions at once.
  accounts: [
    "access",
    "list-account-names",
    "list-accounts",
    "view-account",
    "edit-account",
    "revoke-account",
    "invite-account",
    "set-domain-owner",
    "view-account-sessions",
    "revoke-account-sessions",
    "purge-account-sessions",
    "assign-recipient-owner",
    "unassign-recipient-owner",
    "assign-alias-owner",
    "unassign-alias-owner",
  ],
  // An api token acts on behalf of its owner, and every route here is scoped to
  // the caller's own tokens (see ApiTokenController). The actions gate whether
  // an account may manage tokens at all, not whose tokens it may touch.
  "api-tokens": [
    "access",
    "list-api-tokens",
    "create-api-token",
    "edit-api-token",
    "revoke-api-token",
    "regenerate-api-token",
    "delete-api-token",
  ],
  groups: [
    "access",
    "list-groups",
    "view-group",
    "list-group-members",
    "create-group",
    "edit-group",
    "edit-group-global-permissions",
    "edit-group-domain-permissions",
    "delete-group",
    // The three below are enforced in GroupsService, not by a route decorator:
    // they are an alternative to owning the group, never a second condition on
    // top of it (see ServiceEnforcedGlobalPermissions).
    "transfer-group-ownership",
    "add-group-member",
    "remove-group-member",
  ],
  // `access` alone still grants something here: GET /domains returns the
  // domains the caller owns. `list-all-domains` widens that to every domain.
  // `view-domain`, `toggle-domain-active` and `transfer-domain-ownership` are
  // the bridge mirrors of the domain-tier `domain` resource: holding them
  // globally acts on ANY domainId.
  domains: [
    "access",
    "list-all-domains",
    "view-disk-usage",
    "create-domain",
    "view-domain",
    "toggle-domain-active",
    "transfer-domain-ownership",
  ],
  domain_owner_elevated: ["access", "delete-dkim-key", "transfer-domain-ownership"],
  tickets: ["access", "list-tickets", "view-ticket", "create-ticket", "reply-ticket", "handle-ticket", "notification"],
  superadmin: ["access", "resize-any-domain-quota", "delete-any-domain"],
} as const;

export const DOMAIN_ACTIONS = {
  // `transfer-domain-ownership` needs no ownership escape hatch of its own: the
  // lib grants a domain's owner every action of every domain-tier resource on
  // that domain, so an owner passes this check without holding any row.
  domain: ["access", "view-domain", "toggle-domain-active", "transfer-domain-ownership"],
  recipients: [
    "access",
    "list-recipients",
    "view-recipient",
    "view-recipient-headroom",
    "create-recipient",
    "edit-recipient",
    "delete-recipient",
  ],
  aliases: ["access", "list-aliases", "view-alias", "create-alias", "edit-alias", "delete-alias"],
  // "Boites aux lettres": the domain-side owner assignment for recipients and
  // aliases. Two actions to attach an owner (one per kind) and two to release it.
  mailboxes: ["access", "assign-recipient-owner", "unassign-recipient-owner", "assign-alias-owner", "unassign-alias-owner"],
  quotas: ["access", "view-quotas"],
  rspamd: ["access", "view-rspamd-stats", "view-rspamd-history"],
  // `admin` is the Administration tab of a domain. It gates the page itself,
  // and is required *alongside* the resource being administered: rotating a
  // DKIM key needs dkim.rotate-dkim-key AND admin.manage-dkim.
  admin: ["access", "view-admin-page", "toggle-domain-active", "manage-dkim"],
  dkim: ["access", "view-dkim", "check-dkim-dns", "rotate-dkim-key", "delete-dkim-key"],
} as const;

export type GlobalResource = keyof typeof GLOBAL_ACTIONS;
export type DomainResource = keyof typeof DOMAIN_ACTIONS;

export type GlobalAction<R extends GlobalResource = GlobalResource> = (typeof GLOBAL_ACTIONS)[R][number];
export type DomainAction<R extends DomainResource = DomainResource> = (typeof DOMAIN_ACTIONS)[R][number];

// Derived, never re-declared: the action map is the one place a resource is
// born, so a resource cannot exist without its action list.
export const GLOBAL_RESOURCES = Object.keys(GLOBAL_ACTIONS) as GlobalResource[];
export const DOMAIN_RESOURCES = Object.keys(DOMAIN_ACTIONS) as DomainResource[];

// A dependency is a (resource, its own actions) pair -- the mapped-type-then-index
// trick makes `{ resource: "sieve", action: ["delete-dkim-key"] }` a type error.
type GlobalDependency = { [R in GlobalResource]: { resource: R; action: GlobalAction<R>[] } }[GlobalResource];
type DomainDependency = { [R in DomainResource]: { resource: R; action: DomainAction<R>[] } }[DomainResource];

export type GlobalDependsOnEntry = { resource: GlobalResource; dependsOn: GlobalDependency[] };
export type DomainDependsOnEntry = { resource: DomainResource; dependsOn: DomainDependency[] };

export const GLOBAL_RESOURCES_DEPENDS_ON: GlobalDependsOnEntry[] = [
  // Managing groups means naming their members, which means reading account
  // names -- `list-account-names` (GET /accounts/names), not the full
  // `list-accounts`. A group manager has no business reading emails and roles.
  { resource: "groups", dependsOn: [{ resource: "accounts", action: ["access", "list-account-names"] }] },
  { resource: "tickets", dependsOn: [{ resource: "domains", action: ["access"] }] },
];

export const DOMAIN_RESOURCE_DEPENDS_ON: DomainDependsOnEntry[] = [
  { resource: "recipients", dependsOn: [{ resource: "domain", action: ["access"] }] },
  { resource: "aliases", dependsOn: [{ resource: "domain", action: ["access"] }] },
  { resource: "mailboxes", dependsOn: [{ resource: "domain", action: ["access"] }] },
  { resource: "quotas", dependsOn: [{ resource: "domain", action: ["access"] }] },
  { resource: "rspamd", dependsOn: [{ resource: "domain", action: ["access"] }] },
  { resource: "admin", dependsOn: [{ resource: "domain", action: ["access"] }] },
  {
    resource: "dkim",
    dependsOn: [
      { resource: "domain", action: ["access"] },
      { resource: "admin", action: ["access", "view-admin-page"] },
    ],
  },
];

// superadmin's dependsOn lists every other global resource with ALL of its own
// actions, not prerequisites superadmin itself needs. enforceDependsOn
// (GroupGlobalPermissions.vue) grants whatever the CHECKED resource's dependsOn
// lists, so ticking superadmin:access grants the whole server at once. Built
// from GLOBAL_ACTIONS rather than a frozen list, so a new action joins it for
// free.
function dependsOnSuperadmin(): GlobalDependsOnEntry[] {
  return [
    {
      resource: "superadmin",
      dependsOn: GLOBAL_RESOURCES.filter((resource) => resource !== "superadmin").map((resource) => ({
        resource,
        action: [...GLOBAL_ACTIONS[resource]],
      })) as GlobalDependency[],
    },
  ];
}

GLOBAL_RESOURCES_DEPENDS_ON.push(...dependsOnSuperadmin());

// Flattens this catalog's { resource, action: string[] }[] shape into the guard
// lib's own { resource, action: string }[] shape (one action per entry) -- only
// consumed by custom-permission-guard.service.ts's schema.
export function dependsOnFor(resource: string): { resource: string; action: string }[] | undefined {
  const entry = DOMAIN_RESOURCE_DEPENDS_ON.find((e) => e.resource === resource)?.dependsOn;
  return entry?.flatMap((dep) => dep.action.map((action) => ({ resource: dep.resource, action })));
}

// Same flattening, for GLOBAL_RESOURCES_DEPENDS_ON.
export function dependsOnForGlobal(resource: string): { resource: string; action: string }[] | undefined {
  const entry = GLOBAL_RESOURCES_DEPENDS_ON.find((e) => e.resource === resource)?.dependsOn;
  return entry?.flatMap((dep) => dep.action.map((action) => ({ resource: dep.resource, action })));
}

// The bridge forwards a domain-tier action name straight to the global
// `domains` resource. A name missing there surfaces as a config error on the
// first request that needs it, i.e. a 500 in production. Assert it at import
// time instead: a typo costs a failed boot, not a broken route.
function assertBridgeIsSound() {
  const globalDomains: readonly string[] = GLOBAL_ACTIONS.domains;
  const missing = DOMAIN_ACTIONS.domain.filter((action) => !globalDomains.includes(action));
  if (missing.length) {
    throw new Error(
      `ACL catalog: GLOBAL_ACTIONS.domains must be a superset of DOMAIN_ACTIONS.domain ` +
        `(bridgeFromGlobal forwards the action verbatim). Missing: ${missing.join(", ")}`
    );
  }
}

assertBridgeIsSound();
