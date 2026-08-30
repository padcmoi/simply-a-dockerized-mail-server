import { z } from "zod";

// Caps of a delegation: null max = unlimited count, the quota is always a hard
// ceiling in whole megabytes (0 = the account may create nothing that reserves
// disk, aliases stay possible under their own cap).
const caps = {
  maxRecipients: z.number().int().min(0).max(100000).nullable(),
  maxAliases: z.number().int().min(0).max(100000).nullable(),
  quotaMb: z.number().int().min(0).max(1073741824),
};

// How long an invitation or open link stands, in days. Null = never expires,
// it stands until revoked.
const expiresDays = z.number().int().min(1).max(3650).nullable();

// Free label of an open registration link (who it is meant for). Blank = none.
const note = z
  .string()
  .trim()
  .max(30)
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

export const delegationCapsSchema = z.object(caps).strict();

export const createDelegationTokenSchema = z.object({ ...caps, expiresDays, note }).strict();

export const inviteDelegationSchema = z
  .object({
    email: z
      .email()
      .max(255)
      .transform((v) => v.toLowerCase()),
    ...caps,
    expiresDays,
  })
  .strict();

export const editDelegationInviteSchema = z.object({ ...caps, expiresDays, note }).strict();

export type DelegationCapsDto = z.infer<typeof delegationCapsSchema>;
export type CreateDelegationTokenDto = z.infer<typeof createDelegationTokenSchema>;
export type InviteDelegationDto = z.infer<typeof inviteDelegationSchema>;
export type EditDelegationInviteDto = z.infer<typeof editDelegationInviteSchema>;
