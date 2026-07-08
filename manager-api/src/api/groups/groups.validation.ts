import { z } from "zod";
import {
  DOMAIN_RESOURCE_DEPENDS_ON,
  DOMAIN_RESOURCES,
  GLOBAL_RESOURCES,
  GLOBAL_RESOURCES_DEPENDS_ON,
  PERMISSION_ACTIONS,
} from "../../core/custom-permission-guard/permission-catalog";

// Re-exported, not redeclared: permission-catalog.ts is the single
// canonical source for this catalog -- see its own header comment.
export { GLOBAL_RESOURCES, DOMAIN_RESOURCES, PERMISSION_ACTIONS, DOMAIN_RESOURCE_DEPENDS_ON, GLOBAL_RESOURCES_DEPENDS_ON };
export type GlobalResource = (typeof GLOBAL_RESOURCES)[number];
export type DomainResource = (typeof DOMAIN_RESOURCES)[number];
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
