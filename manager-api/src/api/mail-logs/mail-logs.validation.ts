import { z } from "zod";

export const MAIL_LOG_SERVICES = ["postfix", "dovecot"] as const;

export type MailLogService = (typeof MAIL_LOG_SERVICES)[number];

export const mailLogQuerySchema = z.object({
  lines: z.coerce.number().int().min(1).max(5000).default(500),
  q: z.string().trim().max(200).optional(),
  before: z.coerce.number().int().min(0).optional(),
});

export type MailLogQuery = z.infer<typeof mailLogQuerySchema>;
