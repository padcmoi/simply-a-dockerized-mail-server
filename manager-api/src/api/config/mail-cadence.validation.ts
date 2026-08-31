import { z } from "zod";

export const updateMailCadenceSchema = z
  .object({
    offlineNotifyAfterMs: z.number().int().min(10_000).max(86_400_000),
    offlineSweepIntervalMs: z.number().int().min(5_000).max(3_600_000),
    mailMinIntervalMs: z.number().int().min(0).max(3_600_000),
  })
  .superRefine((v, ctx) => {
    if (v.mailMinIntervalMs > v.offlineNotifyAfterMs) {
      ctx.addIssue({
        code: "custom",
        path: ["mailMinIntervalMs"],
        message: "The anti-spam interval cannot exceed the pending-notification delay",
      });
    }
    if (v.offlineSweepIntervalMs > v.offlineNotifyAfterMs) {
      ctx.addIssue({
        code: "custom",
        path: ["offlineSweepIntervalMs"],
        message: "The check frequency cannot exceed the pending-notification delay",
      });
    }
  });

export type UpdateMailCadenceDto = z.infer<typeof updateMailCadenceSchema>;
