import { z } from "zod";

export const updateAlertSchema = z.object({
  adminAlertEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .refine((v) => v === "" || z.email().safeParse(v).success, {
      message: "The alert address must be a valid email address, or empty",
    }),
});

export type UpdateAlertDto = z.infer<typeof updateAlertSchema>;
