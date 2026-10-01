import { z } from "zod";

const SINGLE_LINE = /^[^\r\n]*$/;

export const sendAlertSchema = z.object({
  subject: z.string().trim().min(1).max(200).regex(SINGLE_LINE, "The subject must hold on one line"),
  message: z.string().trim().min(1).max(10_000),
});

export type SendAlertDto = z.infer<typeof sendAlertSchema>;
