import { z } from "zod";

export const sendInvitationSchema = z.object({
  email: z.string().email(),
  groupId: z.string().uuid().nullable().default(null),
});

// Identity comes from the invitation's email; accepting only sets the password
// and an optional display name (stored on the profile).
export const acceptInvitationSchema = z.object({
  password: z.string().min(8),
  displayName: z.string().max(255).optional(),
});

// Admin-facing edit: email (login identity), enabled, and the display name.
export const updateAccountSchema = z.object({
  email: z.string().email().max(255).optional(),
  displayName: z.string().max(255).nullable().optional(),
  enabled: z.boolean().optional(),
});

export type SendInvitationDto = z.infer<typeof sendInvitationSchema>;
export type AcceptInvitationDto = z.infer<typeof acceptInvitationSchema>;
export type UpdateAccountDto = z.infer<typeof updateAccountSchema>;
