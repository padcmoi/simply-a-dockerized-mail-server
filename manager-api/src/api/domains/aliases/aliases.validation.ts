import { z } from "zod";

// The domain is provided by the parent route segment; the body only carries
// the source's local-part and the (full) destination. The service composes the
// final source as `${localPart}@${domain}`.
//
// The character class has no "@" in it, deliberately: a client cannot smuggle
// a domain into the local-part and have its alias land on a domain the route
// never authorised. The source is always rebuilt from the route's domain, it
// is never read from the body.
// Lowercased before it ever reaches the DB: postfix's virtual_aliases lookups
// are case-sensitive, so a mixed-case source/destination silently makes the
// alias never match real, lowercase incoming mail.
const localPart = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9._+-]+$/i, "must be a valid mailbox local-part")
  .transform((v) => v.toLowerCase());

// `.strict()` on both: `source` and `domain` are computed, never accepted. Left
// unstrict, zod would drop them and answer 200 to a body that plainly asked to
// move the alias somewhere the route never authorised.
export const createAliasSchema = z
  .object({
    localPart,
    destination: z
      .string()
      .email()
      .max(255)
      .transform((v) => v.toLowerCase()),
    userEndDate: z.string().date().nullable().optional(),
  })
  .strict();

// `localPart` is settable here, unlike on recipients: an alias is a routing rule,
// not a mailbox. It owns no maildir and no quota row, so rewriting its source
// strands nothing on disk. It stays a local-part for the reason above.
export const updateAliasSchema = z
  .object({
    localPart: localPart.optional(),
    destination: z
      .string()
      .email()
      .max(255)
      .transform((v) => v.toLowerCase())
      .optional(),
    userEndDate: z.string().date().nullable().optional(),
  })
  .strict();

export type CreateAliasDto = z.infer<typeof createAliasSchema>;
export type UpdateAliasDto = z.infer<typeof updateAliasSchema>;
