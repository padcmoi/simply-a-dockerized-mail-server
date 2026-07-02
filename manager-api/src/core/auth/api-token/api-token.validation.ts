import { z } from "zod";

export const createApiTokenSchema = z.object({
  name: z.string().min(1).max(255),
  allowedIps: z.array(z.string().ip()).max(50).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const updateApiTokenSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  allowedIps: z.array(z.string().ip()).max(50).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export type CreateApiTokenDto = z.infer<typeof createApiTokenSchema>;
export type UpdateApiTokenDto = z.infer<typeof updateApiTokenSchema>;
