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
export const createRecipientSchema = z.object({
  localPart: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9._+-]+$/i, "must be a valid mailbox local-part"),
  password: z.string().min(8).max(255),
  quota: z.number().int().min(MIN_RECIPIENT_QUOTA_BYTES, `Recipient quota must be at least ${MIN_RECIPIENT_QUOTA_BYTES} bytes (1 MB)`),
  active: z.boolean().optional(),
  userEndDate: z.string().date().nullable().optional(),
});

export const updateRecipientSchema = z.object({
  password: z.string().min(8).max(255).optional(),
  quota: z
    .number()
    .int()
    .min(MIN_RECIPIENT_QUOTA_BYTES, `Recipient quota must be at least ${MIN_RECIPIENT_QUOTA_BYTES} bytes (1 MB)`)
    .optional(),
  active: z.boolean().optional(),
  userEndDate: z.string().date().nullable().optional(),
});

export type CreateRecipientDto = z.infer<typeof createRecipientSchema>;
export type UpdateRecipientDto = z.infer<typeof updateRecipientSchema>;
