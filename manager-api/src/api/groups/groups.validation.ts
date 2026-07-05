import { z } from "zod";

// Global resources (independent of any domain) -- acls.md.
export const GLOBAL_RESOURCES = ["sieve", "rspamd", "postfix", "accounts", "api-tokens", "groups", "domains"] as const;
export type GlobalResource = (typeof GLOBAL_RESOURCES)[number];

// Domain-scoped resources -- backend-acl-domain.md. `domain` is the gate
// resource: "this domain is assigned to the group", checked before any of
// the others for a given domain_id.
export const DOMAIN_RESOURCES = ["domain", "recipients", "aliases", "quotas", "dkim", "spamd"] as const;
export type DomainResource = (typeof DOMAIN_RESOURCES)[number];

// `access` is a mandatory prerequisite to the other 4: without it, the other
// actions have no effect even if granted (enforced by @naskot/custom-permission-guard).
export const PERMISSION_ACTIONS = ["access", "read", "create", "modify", "delete"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

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

export const permissionEntrySchema = z.object({
  resource: z.enum(GLOBAL_RESOURCES),
  action: z.enum(PERMISSION_ACTIONS),
});

export const setGlobalPermissionsSchema = z.object({
  permissions: z.array(permissionEntrySchema),
});

export const domainPermissionEntrySchema = z.object({
  domainId: z.number().int().positive(),
  resource: z.enum(DOMAIN_RESOURCES),
  action: z.enum(PERMISSION_ACTIONS),
});

export const setDomainPermissionsSchema = z.object({
  permissions: z.array(domainPermissionEntrySchema),
});

export const updateOwnerSchema = z.object({
  newOwnerId: z.number().int().positive(),
});

export const addMemberSchema = z.object({
  accountId: z.number().int().positive(),
});

export type CreateGroupDto = z.infer<typeof createGroupSchema>;
export type UpdateGroupDto = z.infer<typeof updateGroupSchema>;
export type SetGlobalPermissionsDto = z.infer<typeof setGlobalPermissionsSchema>;
export type SetDomainPermissionsDto = z.infer<typeof setDomainPermissionsSchema>;
export type UpdateOwnerDto = z.infer<typeof updateOwnerSchema>;
export type AddMemberDto = z.infer<typeof addMemberSchema>;
