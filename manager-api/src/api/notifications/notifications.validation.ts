import { z } from "zod";
import { paginationQuerySchema } from "../../core/common/pagination.validation";
import { NOTIFICATION_SOURCES } from "../../core/notifications/notifications.service";

export const notificationListQuerySchema = paginationQuerySchema.extend({
  read: z.enum(["read", "unread"]).optional(),
  source: z.enum(NOTIFICATION_SOURCES).optional(),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

export const purgeNotificationsSchema = z.object({
  scope: z.enum(["all", "read"]).default("read"),
});

export type PurgeNotificationsDto = z.infer<typeof purgeNotificationsSchema>;

export const updatePreferenceSchema = z
  .object({
    source: z.enum(NOTIFICATION_SOURCES),
    inApp: z.boolean(),
    email: z.boolean(),
  })
  .strict();

export type UpdatePreferenceDto = z.infer<typeof updatePreferenceSchema>;
