import { z } from "zod";

// Owner-side edit of a mailbox the caller owns: password and the active flag are
// the only fields it may touch. Quota is a domain-capacity decision, and the
// address is the mailbox identity, so neither is accepted here. At least one
// field must be present so an empty body is a 400, not a silent 200.
export const updateMyRecipientSchema = z
  .object({
    password: z.string().min(8).max(255).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.password !== undefined || v.active !== undefined, {
    message: "Provide a password or an active flag to update",
  });

// Owner-side edit of an alias the caller owns: only the destination. The source
// is the address the domain owner handed over and is never rebuilt from the body.
export const updateMyAliasSchema = z
  .object({
    destination: z
      .string()
      .email()
      .max(255)
      .transform((v) => v.toLowerCase()),
  })
  .strict();

export type UpdateMyRecipientDto = z.infer<typeof updateMyRecipientSchema>;
export type UpdateMyAliasDto = z.infer<typeof updateMyAliasSchema>;
