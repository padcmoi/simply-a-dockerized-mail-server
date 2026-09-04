import { z } from "zod";

// A six-digit code from the app, or a recovery code, both typed by hand: the
// shape stays loose here (spaces, a dash, either case) and the service decides
// which of the two it was handed. The upper bound only keeps a payload honest.
const codeSchema = z.string().trim().min(6).max(32);

export const twoFactorCodeSchema = z.object({ code: codeSchema }).strict();

export const twoFactorLoginSchema = z
  .object({
    challenge: z.string().min(16).max(128),
    code: codeSchema,
  })
  .strict();

export type TwoFactorCodeDto = z.infer<typeof twoFactorCodeSchema>;
export type TwoFactorLoginDto = z.infer<typeof twoFactorLoginSchema>;
