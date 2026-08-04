import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(255),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(8),
});

// email is the login identity, so it can be changed but never cleared (no
// `.nullable()`). Every other field is a personal profile attribute stored on
// account_profiles; `city` drives geocoding into latitude/longitude.
export const updateProfileSchema = z.object({
  email: z.string().email().max(255).optional(),
  displayName: z.string().max(255).nullable().optional(),
  avatarUrl: z.string().url().max(1024).nullable().optional(),
  phone: z.string().max(32).nullable().optional(),
  addressLine: z.string().max(255).nullable().optional(),
  addressComplement: z.string().max(255).nullable().optional(),
  city: z.string().max(255).nullable().optional(),
  postalCode: z.string().max(32).nullable().optional(),
  country: z.string().max(255).nullable().optional(),
  // A concrete interface locale code (e.g. "fr_FR", "en_GB"), or null to clear.
  locale: z
    .string()
    .regex(/^[a-z]{2}_[A-Z]{2}$/)
    .nullable()
    .optional(),
});

export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshDto = z.infer<typeof refreshSchema>;
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
