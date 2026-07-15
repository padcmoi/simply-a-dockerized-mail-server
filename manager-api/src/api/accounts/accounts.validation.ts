import { z } from "zod";

// A domain is mandatory: the invitation email is sent from postmaster@<domain>
// so SPF/DKIM are valid and it does not land in spam. groupIds may target several
// groups at once; the default group is auto-assigned on account creation and is
// never part of this list.
export const sendInvitationSchema = z.object({
  email: z.string().email(),
  domainId: z.coerce.number().int().positive(),
  groupIds: z.array(z.string().uuid()).default([]),
  // When true, accepting the invitation makes the new account the owner of the
  // chosen domain (virtual_domains.owner_id). A domain has a single owner.
  makeOwner: z.boolean().default(false),
});

// Identity comes from the invitation's email; accepting only sets the password
// and an optional display name (stored on the profile).
export const acceptInvitationSchema = z.object({
  password: z.string().min(8),
  displayName: z.string().max(255).optional(),
});

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

export type SendInvitationDto = z.infer<typeof sendInvitationSchema>;
export type AcceptInvitationDto = z.infer<typeof acceptInvitationSchema>;
export type UpdateAccountDto = z.infer<typeof updateAccountSchema>;
