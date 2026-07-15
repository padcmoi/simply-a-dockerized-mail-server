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

export type SendInvitationDto = z.infer<typeof sendInvitationSchema>;
export type AcceptInvitationDto = z.infer<typeof acceptInvitationSchema>;
