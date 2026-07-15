import { z } from "zod";

// Admin-facing edit: the full set of a user's editable fields. email is the
// login identity (changeable, never cleared) and enabled is the admin-only gate;
// every other field is a personal profile attribute on account_profiles, with
// `city` driving geocoding into latitude/longitude. Mirrors updateProfileSchema
// (the self-service PATCH /auth/jwt/me) so an administrator can edit the same
// fields the owner can, plus enabled.
export const updateAccountSchema = z.object({
  email: z.string().email().max(255).optional(),
  displayName: z.string().max(255).nullable().optional(),
  avatarUrl: z.string().url().max(1024).nullable().optional(),
  phone: z.string().max(32).nullable().optional(),
  addressLine: z.string().max(255).nullable().optional(),
  addressComplement: z.string().max(255).nullable().optional(),
  city: z.string().max(255).nullable().optional(),
  postalCode: z.string().max(32).nullable().optional(),
  country: z.string().max(255).nullable().optional(),
  enabled: z.boolean().optional(),
});

export type UpdateAccountDto = z.infer<typeof updateAccountSchema>;
