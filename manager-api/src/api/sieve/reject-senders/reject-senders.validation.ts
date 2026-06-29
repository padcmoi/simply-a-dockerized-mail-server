import { z } from "zod";

export const createRejectSenderSchema = z.object({
  sender: z.string().min(2).max(255),
});

export const toggleRejectSenderSchema = z.object({
  enabled: z.boolean(),
});

export type CreateRejectSenderDto = z.infer<typeof createRejectSenderSchema>;
export type ToggleRejectSenderDto = z.infer<typeof toggleRejectSenderSchema>;
