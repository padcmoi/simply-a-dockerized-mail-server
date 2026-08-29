import { z } from "zod";

// What a key may use, out of what its account holds. Absent or empty means the
// key was never narrowed and keeps the account's whole reach, which is what
// every key minted before scoping existed does.
//
// Nothing here can widen anything: the service refuses any entry its author does
// not hold, and the permission guards still resolve the account's own rights at
// every request. The scope is a floor under a ceiling that has not moved.
const scopeEntrySchema = z.object({
  resource: z.string().min(1).max(64),
  actions: z.array(z.string().min(1).max(64)).min(1).max(32),
});

const domainScopeEntrySchema = scopeEntrySchema.extend({
  domainId: z.number().int().positive(),
});

export const tokenScopesSchema = z.object({
  global: z.array(scopeEntrySchema).max(64).default([]),
  domain: z.array(domainScopeEntrySchema).max(256).default([]),
});

export const createApiTokenSchema = z.object({
  name: z.string().min(1).max(255),
  allowedIps: z.array(z.string().ip()).max(50).optional(),
  scopes: tokenScopesSchema.nullable().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const updateApiTokenSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  allowedIps: z.array(z.string().ip()).max(50).nullable().optional(),
  scopes: tokenScopesSchema.nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export type CreateApiTokenDto = z.infer<typeof createApiTokenSchema>;
export type UpdateApiTokenDto = z.infer<typeof updateApiTokenSchema>;
