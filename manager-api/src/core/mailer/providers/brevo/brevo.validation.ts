import { z } from "zod";

export function refineBrevo(value: { username?: string | null; fromAddress?: string | null }, ctx: z.RefinementCtx) {
  if (!value.username?.trim()) {
    ctx.addIssue({ code: "custom", path: ["username"], message: "A username is required for Brevo" });
  }
  if (!value.fromAddress?.trim()) {
    ctx.addIssue({ code: "custom", path: ["fromAddress"], message: "A verified sender address is required" });
  }
}
