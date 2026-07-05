import { z } from "zod";

export const sendInvitationSchema = z.object({
  email: z.string().email(),
  groupId: z.number().int().positive().nullable().default(null),
});

export const acceptInvitationSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9_.-]+$/, "Only lowercase letters, digits, underscores, dots and hyphens"),
  password: z.string().min(8),
  name: z.string().max(255).optional(),
});

export type SendInvitationDto = z.infer<typeof sendInvitationSchema>;
export type AcceptInvitationDto = z.infer<typeof acceptInvitationSchema>;
