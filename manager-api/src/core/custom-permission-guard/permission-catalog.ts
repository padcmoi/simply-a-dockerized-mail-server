/**
 * ACL Catalog
 */

export const GLOBAL_RESOURCES = ["sieve", "rspamd", "postfix", "accounts", "api-tokens", "groups", "domains"] as const;

export const DOMAIN_RESOURCES = ["domain", "recipients", "aliases", "quotas", "rspamd", "admin", "dkim"] as const;

type Actions = "access" | "read" | "create" | "modify" | "delete";

type DependsOnTable = {
  resource: (typeof GLOBAL_RESOURCES)[number] | (typeof DOMAIN_RESOURCES)[number];
  dependsOn: { resource: (typeof GLOBAL_RESOURCES)[number] | (typeof DOMAIN_RESOURCES)[number]; action: Actions[] }[];
}[];

export const GLOBAL_RESOURCES_DEPENDS_ON: DependsOnTable = [
  {
    resource: "groups",
    dependsOn: [{ resource: "accounts", action: ["access", "read"] }],
  },
];

export const DOMAIN_RESOURCE_DEPENDS_ON: DependsOnTable = [
  { resource: "recipients", dependsOn: [{ resource: "domain", action: ["access"] }] },
  { resource: "aliases", dependsOn: [{ resource: "domain", action: ["access"] }] },
  { resource: "quotas", dependsOn: [{ resource: "domain", action: ["access"] }] },
  { resource: "rspamd", dependsOn: [{ resource: "domain", action: ["access"] }] },
  { resource: "admin", dependsOn: [{ resource: "domain", action: ["access"] }] },
  {
    resource: "dkim",
    dependsOn: [
      { resource: "domain", action: ["access"] },
      { resource: "admin", action: ["access", "read"] },
    ],
  },
];

export const PERMISSION_ACTIONS = ["access", "read", "create", "modify", "delete"] as const;

// Flattens this catalog's { resource, action: string[] }[] shape into the
// guard lib's own { resource, action: string }[] shape (one action per
// entry) -- only consumed by custom-permission-guard.service.ts's schema.
export function dependsOnFor(resource: string): { resource: string; action: string }[] | undefined {
  const entry = DOMAIN_RESOURCE_DEPENDS_ON.find((e) => e.resource === resource)?.dependsOn;
  return entry?.flatMap((dep) => dep.action.map((action) => ({ resource: dep.resource, action })));
}

// Same flattening, for GLOBAL_RESOURCES_DEPENDS_ON.
export function dependsOnForGlobal(resource: string): { resource: string; action: string }[] | undefined {
  const entry = GLOBAL_RESOURCES_DEPENDS_ON.find((e) => e.resource === resource)?.dependsOn;
  return entry?.flatMap((dep) => dep.action.map((action) => ({ resource: dep.resource, action })));
}
