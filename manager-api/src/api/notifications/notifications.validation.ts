import { z } from "zod";
import { NOTIFICATION_SOURCES } from "../../core/notifications/notifications.service";

export const updatePreferenceSchema = z
  .object({
    source: z.enum(NOTIFICATION_SOURCES),
    inApp: z.boolean(),
    email: z.boolean(),
  })
  .strict();

export type UpdatePreferenceDto = z.infer<typeof updatePreferenceSchema>;
