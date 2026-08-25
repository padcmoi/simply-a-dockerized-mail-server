import { z } from "zod";

// A domain is mandatory: the invitation email is sent from postmaster@<domain>
// so SPF/DKIM are valid and it does not land in spam. groupIds may target several
// groups at once; the default group is auto-assigned on account creation and is
// never part of this list.
export const sendInvitationSchema = z.object({
  // Lowercased before it ever reaches the DB: this becomes the account's login
  // identity (accounts.email) on acceptance, and a mixed-case value would let
  // "Dodo@x.com" and "dodo@x.com" exist as two different accounts.
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase()),
  domainId: z.coerce.number().int().positive(),
  groupIds: z.array(z.string().uuid()).default([]),
  // Existing, unassigned recipients/aliases of the chosen domain to hand to the
  // invitee on acceptance (0..N of each). Pure ownership assignment: no password
  // is generated or changed.
  recipientIds: z.array(z.coerce.number().int().positive()).default([]),
  aliasIds: z.array(z.coerce.number().int().positive()).default([]),
  // When true, accepting the invitation makes the new account the owner of the
  // chosen domain (virtual_domains.owner_id). A domain has a single owner.
  makeOwner: z.boolean().default(false),
  // When true, the invitee also joins the group dedicated to this domain
  // (custom-<domain>-group; found or created here). Whether that group already
  // exists says nothing about the CURRENT intent of this particular invite --
  // a domain's dedicated group, once created, stays in the DB forever, so
  // membership must be driven by this explicit flag, not by the group's mere
  // existence (which stayed true even after the admin toggled the switch back off).
  useDomainGroup: z.boolean().default(false),
});

// Identity comes from the invitation's email when pinned; an open registration
// token (email NULL) takes the visitor's own address instead. Password plus an
// optional display name (stored on the profile) complete the account.
export const acceptInvitationSchema = z.object({
  email: z
    .string()
    .email()
    .max(255)
    .transform((v) => v.toLowerCase())
    .optional(),
  password: z.string().min(8),
  displayName: z.string().max(255).optional(),
});

export type SendInvitationDto = z.infer<typeof sendInvitationSchema>;
export type AcceptInvitationDto = z.infer<typeof acceptInvitationSchema>;

// Query of GET invite/:token/email-exists.
export const emailExistsQuerySchema = z.object({
  email: z
    .string()
    .email()
    .max(255)
    .transform((v) => v.toLowerCase()),
});

export type EmailExistsQueryDto = z.infer<typeof emailExistsQuerySchema>;
