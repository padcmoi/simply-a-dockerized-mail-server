import { z } from "zod";

// The domain is provided by the parent route segment; body only carries
// the source's local-part and the (full) destination. Service composes
// the final source as `${localPart}@${domain}`.
export const createAliasSchema = z.object({
  localPart: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9._+-]+$/i, "must be a valid mailbox local-part"),
  destination: z.string().email().max(255),
  userEndDate: z.string().date().nullable().optional(),
});

export const updateAliasSchema = z.object({
  destination: z.string().email().max(255).optional(),
  userEndDate: z.string().date().nullable().optional(),
});

export type CreateAliasDto = z.infer<typeof createAliasSchema>;
export type UpdateAliasDto = z.infer<typeof updateAliasSchema>;
