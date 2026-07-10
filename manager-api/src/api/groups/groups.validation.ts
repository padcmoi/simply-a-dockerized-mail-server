import { z } from "zod";
import {
  DOMAIN_ACTIONS,
  DOMAIN_RESOURCE_DEPENDS_ON,
  DOMAIN_RESOURCES,
  GLOBAL_ACTIONS,
  GLOBAL_RESOURCES,
  GLOBAL_RESOURCES_DEPENDS_ON,
} from "../../core/custom-permission-guard/permission-catalog";

// Re-exported, not redeclared: permission-catalog.ts is the single
// canonical source for this catalog -- see its own header comment.
export {
  GLOBAL_ACTIONS,
  DOMAIN_ACTIONS,
  GLOBAL_RESOURCES,
  DOMAIN_RESOURCES,
  DOMAIN_RESOURCE_DEPENDS_ON,
  GLOBAL_RESOURCES_DEPENDS_ON,
};
export type {
  GlobalResource,
  DomainResource,
  GlobalAction,
  DomainAction,
} from "../../core/custom-permission-guard/permission-catalog";

// A permission entry is validated against the actions ITS OWN resource
// declares, not against a shared vocabulary. Written as a discriminated union on
// `resource` so a rejected body names the offending resource rather than
// listing every action in the system. A flat `z.enum(PERMISSION_ACTIONS)` would
// happily persist `sieve.delete-dkim-key` into group_global_permissions, where
// the guard would then throw a config error on the first request that read it.
//
// The `as` cast is unavoidable: z.discriminatedUnion demands a non-empty tuple,
// which Object.entries().map() cannot prove to the compiler.
function permissionUnion<T extends Record<string, readonly [string, ...string[]]>>(actionsByResource: T) {
  const branches = Object.entries(actionsByResource).map(([resource, actions]) =>
    z.object({
      resource: z.literal(resource),
      action: z.enum(actions as unknown as [string, ...string[]]),
    })
  );
  return z.discriminatedUnion("resource", branches as [(typeof branches)[number], ...(typeof branches)[number][]]);
}

export const createGroupSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1024).nullable().optional(),
  isDefault: z.boolean().optional(),
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1024).nullable().optional(),
  isDefault: z.boolean().optional(),
});

export const permissionEntrySchema = permissionUnion(GLOBAL_ACTIONS);

export const setGlobalPermissionsSchema = z.object({
  permissions: z.array(permissionEntrySchema),
});

export const domainPermissionEntrySchema = z.intersection(
  z.object({ domainId: z.number().int().positive() }),
  permissionUnion(DOMAIN_ACTIONS)
);

export const setDomainPermissionsSchema = z.object({
  permissions: z.array(domainPermissionEntrySchema),
});

export const updateOwnerSchema = z.object({
  newOwnerId: z.string().uuid(),
});

export const addMemberSchema = z.object({
  accountId: z.string().uuid(),
});

export type CreateGroupDto = z.infer<typeof createGroupSchema>;
export type UpdateGroupDto = z.infer<typeof updateGroupSchema>;
export type SetGlobalPermissionsDto = z.infer<typeof setGlobalPermissionsSchema>;
export type SetDomainPermissionsDto = z.infer<typeof setDomainPermissionsSchema>;
export type UpdateOwnerDto = z.infer<typeof updateOwnerSchema>;
export type AddMemberDto = z.infer<typeof addMemberSchema>;
