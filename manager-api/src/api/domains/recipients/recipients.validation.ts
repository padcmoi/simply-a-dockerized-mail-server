import { z } from "zod";

// A recipient mailbox must always reserve real disk space -- no such thing
// as an "unlimited" mailbox here. The one exception, postmaster@<domain>, is
// never created or updated through this schema: it's provisioned directly by
// DomainsService.reservePostmaster with quota locked at 0, and RecipientsService
// refuses any attempt to touch it via these endpoints (see recipients.service.ts).
export const MIN_RECIPIENT_QUOTA_BYTES = 1024 * 1024; // 1 MB

// The domain is provided by the parent route segment, so the body only
// carries the recipient's local-part. Service composes the final address
// as `${localPart}@${domain}`.
export const createRecipientSchema = z
  .object({
    // Lowercased before it ever reaches the DB: postfix/dovecot's virtual_users
    // lookups are case-sensitive, so a mixed-case local-part (e.g. "Dodo@...")
    // silently makes the mailbox unreachable by real, lowercase incoming mail.
    localPart: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9._+-]+$/i, "must be a valid mailbox local-part")
      .transform((v) => v.toLowerCase()),
    password: z.string().min(8).max(255),
    quota: z
      .number()
      .int()
      .min(MIN_RECIPIENT_QUOTA_BYTES, `Recipient quota must be at least ${MIN_RECIPIENT_QUOTA_BYTES} bytes (1 MB)`),
    active: z.boolean().optional(),
    userEndDate: z.string().date().nullable().optional(),
  })
  .strict();

// A recipient's address is its identity: `maildir` is derived from it, dovecot's
// own counters in `virtual_quota_users` are keyed by it, and every alias
// `destination` pointing at it is a plain string. None of those follow a rewrite
// of `virtual_users.email`, so renaming a mailbox here would strand the mail it
// already holds. No field of this schema can change it, and `.strict()` makes
// that refusal audible: without it zod silently drops `email` / `localPart` /
// `maildir` / `domain` and the route answers 200 to a rename it never performed.
export const updateRecipientSchema = z
  .object({
    password: z.string().min(8).max(255).optional(),
    quota: z
      .number()
      .int()
      .min(MIN_RECIPIENT_QUOTA_BYTES, `Recipient quota must be at least ${MIN_RECIPIENT_QUOTA_BYTES} bytes (1 MB)`)
      .optional(),
    active: z.boolean().optional(),
    userEndDate: z.string().date().nullable().optional(),
  })
  .strict();

// Body of PUT :id/owner: the account (uuid) to hand this recipient to.
export const assignRecipientOwnerSchema = z.object({ ownerId: z.string().uuid() }).strict();

export type CreateRecipientDto = z.infer<typeof createRecipientSchema>;
export type UpdateRecipientDto = z.infer<typeof updateRecipientSchema>;
export type AssignRecipientOwnerDto = z.infer<typeof assignRecipientOwnerSchema>;
