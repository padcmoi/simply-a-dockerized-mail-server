import { z } from "zod";

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
  quota: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
  userEndDate: z.string().date().nullable().optional(),
});

export const updateRecipientSchema = z.object({
  password: z.string().min(8).max(255).optional(),
  quota: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
  userEndDate: z.string().date().nullable().optional(),
});

export type CreateRecipientDto = z.infer<typeof createRecipientSchema>;
export type UpdateRecipientDto = z.infer<typeof updateRecipientSchema>;
