import { z } from "zod";

export function refineSmtp(value: { host?: string | null }, ctx: z.RefinementCtx) {
  if (!value.host?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["host"], message: "A host is required for a custom SMTP server" });
  }
}
