import { z } from "zod";

export const postfixSettingsSchema = z
  .object({
    bounceSenderLocal: z
      .string()
      .max(64)
      .regex(/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/)
      .refine((v) => !v.includes(".."), "Two dots in a row are not allowed"),
    bounceSenderDomain: z.union([
      z.literal(""),
      z
        .string()
        .max(253)
        .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/),
    ]),
    delayWarningHours: z.number().int().min(0).max(24),
    maximalQueueLifetimeDays: z.number().int().min(1).max(5),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.delayWarningHours >= v.maximalQueueLifetimeDays * 24) {
      ctx.addIssue({
        code: "custom",
        path: ["delayWarningHours"],
        message: "The delay warning must come before the message is given up",
      });
    }
  });

export type PostfixSettingsDto = z.infer<typeof postfixSettingsSchema>;
