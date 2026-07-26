import { z } from "zod";
import { refineBrevo } from "../../core/mailer/providers/brevo/brevo.validation";
import { refineSmtp } from "../../core/mailer/providers/smtp/smtp.validation";

export const MAIL_PROVIDERS = ["brevo", "smtp"] as const;

export const saveMailConfigSchema = z
  .object({
    provider: z.enum(MAIL_PROVIDERS),
    host: z.string().max(255).nullable().optional(),
    port: z.number().int().min(1).max(65535).nullable().optional(),
    secure: z.boolean().optional(),
    username: z.string().max(255).nullable().optional(),
    password: z.string().max(255).optional(),
    fromAddress: z.string().email().max(255).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.provider === "smtp") refineSmtp(value, ctx);
    if (value.provider === "brevo") refineBrevo(value, ctx);
  });

export const testMailConfigSchema = z.object({ provider: z.enum(MAIL_PROVIDERS) });
export const selectMailConfigSchema = z.object({ provider: z.enum(MAIL_PROVIDERS) });
export const verifyMailConfigSchema = z.object({
  provider: z.enum(MAIL_PROVIDERS),
  otp: z.string().regex(/^\d{6}$/, "A 6-digit code is required"),
});

export type SaveMailConfigDto = z.infer<typeof saveMailConfigSchema>;
export type TestMailConfigDto = z.infer<typeof testMailConfigSchema>;
export type SelectMailConfigDto = z.infer<typeof selectMailConfigSchema>;
export type VerifyMailConfigDto = z.infer<typeof verifyMailConfigSchema>;
