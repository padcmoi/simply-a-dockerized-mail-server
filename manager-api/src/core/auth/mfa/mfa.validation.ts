import { z } from "zod";
import { SECURITY_QUESTIONS } from "./security-questions";

// A six-digit code or a free-text answer, both typed by hand: the shape stays
// loose here and the service decides which of the two the challenge expects.
const answerSchema = z.string().trim().min(1).max(255);

export const mfaLoginSchema = z
  .object({
    challenge: z.string().min(16).max(128),
    answer: answerSchema,
  })
  .strict();

export const mfaResendSchema = z.object({ challenge: z.string().min(16).max(128) }).strict();

// Which proof the sign-in wants instead. Only the two: the authenticator app is
// never one of them, since an account that has one is never sent down here.
export const mfaMethodSchema = z
  .object({
    challenge: z.string().min(16).max(128),
    method: z.enum(["email", "question"]),
  })
  .strict();

// One of the questions the API offers, by key, never a sentence: the wording
// belongs to whoever displays it, in their own language. The answer is what
// proves anything, and it is normalised before it is hashed.
export const setSecurityQuestionSchema = z
  .object({
    question: z.enum(SECURITY_QUESTIONS),
    answer: answerSchema,
  })
  .strict();

export type MfaLoginDto = z.infer<typeof mfaLoginSchema>;
export type MfaResendDto = z.infer<typeof mfaResendSchema>;
export type MfaMethodDto = z.infer<typeof mfaMethodSchema>;
export type SetSecurityQuestionDto = z.infer<typeof setSecurityQuestionSchema>;
