import { z } from "zod";
import { ACCOUNT_GENDERS } from "../../entities/account-profile.entity";

export const loginSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(255),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(8),
});

// email is the login identity, so it can be changed but never cleared (no
// `.nullable()`). Every other field is a personal profile attribute stored on
// account_profiles; `city` drives geocoding into latitude/longitude.
// Changing one's own password proves possession of the current one first: a
// stolen session alone must not be enough to lock the owner out. The floor
// mirrors every other password rule in the API (min 8). currentPassword is
// optional at the schema level only for the account that has none, created by
// an external sign-in; the service still demands it whenever one exists.
export const changeMyPasswordSchema = z.object({
  currentPassword: z.string().min(1).max(255).optional(),
  newPassword: z.string().min(8).max(255),
});

export type ChangeMyPasswordDto = z.infer<typeof changeMyPasswordSchema>;

export const updateProfileSchema = z.object({
  email: z.email().max(255).optional(),
  firstName: z.string().max(255).nullable().optional(),
  lastName: z.string().max(255).nullable().optional(),
  gender: z.enum(ACCOUNT_GENDERS).nullable().optional(),
  avatarUrl: z.url().max(1024).nullable().optional(),
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
