// Canonical resource/action catalog -- the ONLY place these are declared.
// Every other consumer (api/groups/groups.validation.ts's Zod enums,
// GroupsController's /permissions/catalog endpoint, and
// custom-permission-guard.service.ts's own guard schema) imports from here.
// Never redeclare a copy elsewhere.
export const GLOBAL_RESOURCES = ["sieve", "rspamd", "postfix", "accounts", "api-tokens", "groups", "domains"] as const;
export const DOMAIN_RESOURCES = ["domain", "recipients", "aliases", "quotas", "spamd", "admin", "dkim"] as const;
export const PERMISSION_ACTIONS = ["access", "read", "create", "modify", "delete"] as const;

// Explicit, directly-editable dependency declarations -- "this resource
// requires these (resource, action[]) pairs, 1 or N actions each" -- rather
// than a programmatic derivation from DOMAIN_RESOURCES. `action` is an array
// here (e.g. a resource could require both domain:access and domain:read
// without a second { resource: "domain", ... } entry); the underlying
// @naskot/custom-permission-guard lib's own dependsOn only accepts a single
// action per entry (`{ resource: string; action: string }[]`, verified in
// its src/types.ts), so dependsOnFor() below flattens this into that shape
// when feeding custom-permission-guard.service.ts's guard schema. The API
// catalog endpoint exposes this array form as-is (see GroupsController).
export const DOMAIN_RESOURCE_DEPENDS_ON = [
  { resource: "recipients", dependsOn: [{ resource: "domain", action: ["access"] }] },
  { resource: "aliases", dependsOn: [{ resource: "domain", action: ["access"] }] },
  { resource: "quotas", dependsOn: [{ resource: "domain", action: ["access"] }] },
  { resource: "spamd", dependsOn: [{ resource: "domain", action: ["access"] }] },
  { resource: "admin", dependsOn: [{ resource: "domain", action: ["access"] }] },
  // dkim needs both: domain:access (like every other domain resource) AND
  // admin:access (DKIM management only happens inside the Administration
  // page, see dkim.controller.ts's dual RequireDomainPermissions entries).
  {
    resource: "dkim",
    dependsOn: [
      { resource: "domain", action: ["access"] },
      { resource: "admin", action: ["access", "read"] },
    ],
  },
] as const;

// Flattens this catalog's { resource, action: string[] }[] shape into the
// guard lib's own { resource, action: string }[] shape (one action per
// entry) -- only consumed by custom-permission-guard.service.ts's schema.
export function dependsOnFor(resource: string): { resource: string; action: string }[] | undefined {
  const entry = DOMAIN_RESOURCE_DEPENDS_ON.find((e) => e.resource === resource)?.dependsOn;
  return entry?.flatMap((dep) => dep.action.map((action) => ({ resource: dep.resource, action })));
}
