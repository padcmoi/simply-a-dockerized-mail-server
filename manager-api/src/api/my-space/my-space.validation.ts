import { z } from "zod";
import { MIN_RECIPIENT_QUOTA_BYTES } from "../domains/recipients/recipients.validation";

// Owner-side edit of a mailbox the caller owns: password, the active flag and
// the quota. The quota change is only honoured under a delegation on the
// mailbox's domain and a raise spends the delegated budget (checked in
// MySpaceService). The address is the mailbox identity and is never accepted.
// At least one field must be present so an empty body is a 400, not a silent
// 200.
export const updateMyRecipientSchema = z
  .object({
    password: z.string().min(8).max(255).optional(),
    active: z.boolean().optional(),
    quota: z
      .number()
      .int()
      .min(MIN_RECIPIENT_QUOTA_BYTES, `Recipient quota must be at least ${MIN_RECIPIENT_QUOTA_BYTES} bytes (1 MB)`)
      .optional(),
  })
  .strict()
  .refine((v) => v.password !== undefined || v.active !== undefined || v.quota !== undefined, {
    message: "Provide a password, an active flag or a quota to update",
  });

// Owner-side edit of an alias the caller owns: only the destination. The source
// is the address the domain owner handed over and is never rebuilt from the body.
export const updateMyAliasSchema = z
  .object({
    destination: z
      .string()
      .email()
      .max(255)
      .transform((v) => v.toLowerCase()),
  })
  .strict();

export type UpdateMyRecipientDto = z.infer<typeof updateMyRecipientSchema>;
export type UpdateMyAliasDto = z.infer<typeof updateMyAliasSchema>;
