import { z } from "zod";

// The domain is provided by the parent route segment; the body only carries
// the source's local-part and the (full) destination. The service composes the
// final source as `${localPart}@${domain}`.
//
// The character class has no "@" in it, deliberately: a client cannot smuggle
// a domain into the local-part and have its alias land on a domain the route
// never authorised. The source is always rebuilt from the route's domain, it
// is never read from the body.
const localPart = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9._+-]+$/i, "must be a valid mailbox local-part");

export const createAliasSchema = z.object({
  localPart,
  destination: z.string().email().max(255),
  userEndDate: z.string().date().nullable().optional(),
});

// `localPart` is settable here too: renaming an alias's source is what the edit
// page exists for, and it stays a local-part for the reason above.
export const updateAliasSchema = z.object({
  localPart: localPart.optional(),
  destination: z.string().email().max(255).optional(),
  userEndDate: z.string().date().nullable().optional(),
});

export type CreateAliasDto = z.infer<typeof createAliasSchema>;
export type UpdateAliasDto = z.infer<typeof updateAliasSchema>;
