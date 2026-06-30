import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(255),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(8),
});

export const updateProfileSchema = z.object({
  name: z.string().max(255).nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  avatarUrl: z.string().url().max(1024).nullable().optional(),
});

export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshDto = z.infer<typeof refreshSchema>;
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
