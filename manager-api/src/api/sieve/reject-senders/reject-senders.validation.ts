import { z } from "zod";

export const createRejectSenderSchema = z.object({
  // Lowercased before it ever reaches the DB: the sieve script matches the
  // envelope sender case-sensitively, so a mixed-case entry (a domain or a
  // full address) silently fails to block real, lowercase incoming mail.
  sender: z
    .string()
    .min(2)
    .max(255)
    .transform((v) => v.toLowerCase()),
});

export const toggleRejectSenderSchema = z.object({
  enabled: z.boolean(),
});

export type CreateRejectSenderDto = z.infer<typeof createRejectSenderSchema>;
export type ToggleRejectSenderDto = z.infer<typeof toggleRejectSenderSchema>;
