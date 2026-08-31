import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPaginationQuery } from "../../core/common/pagination.openapi";
import { NOTIFICATION_SORTABLE_COLUMNS, NOTIFICATION_SOURCES } from "../../core/notifications/notifications.service";

export const NotificationsApi = () => applyDecorators(ApiTags("notifications"), ApiSecurity("apiToken"));

const idParam = () => ApiParam({ name: "id", type: Number, example: 1, description: "Notification id" });

export const ListNotificationsDocs = () =>
  applyDecorators(
    ApiPaginationQuery(NOTIFICATION_SORTABLE_COLUMNS),
    ApiQuery({
      name: "read",
      required: false,
      enum: ["read", "unread"],
      description: "Keep only the read or only the unread ones; both when absent",
    }),
    ApiQuery({
      name: "source",
      required: false,
      enum: NOTIFICATION_SOURCES,
      description: "Keep only what this source raised; every source when absent",
    }),
    ApiOperation({
      summary: "List the caller's own notifications, read and unread",
      description:
        "Scoped to the authenticated account, with no ACL of its own: a notification belongs to whoever it was " +
        "raised for. The free-text filter also searches the payload, which is what carries the ticket subject or " +
        "the domain a notification is about. Omitting `limit` keeps the legacy unpaginated array the feed and the " +
        "internal consumers rely on.",
    })
  );

export const NotificationFeedDocs = () =>
  applyDecorators(ApiOperation({ summary: "Unread count and latest notifications of the caller" }));

export const MarkNotificationReadDocs = () => applyDecorators(idParam(), ApiOperation({ summary: "Mark one notification read" }));

export const MarkAllNotificationsReadDocs = () =>
  applyDecorators(ApiOperation({ summary: "Mark every notification of the caller read" }));

export const MarkNotificationUnreadDocs = () =>
  applyDecorators(idParam(), ApiOperation({ summary: "Mark one notification unread again" }));

export const DeleteNotificationDocs = () => applyDecorators(idParam(), ApiOperation({ summary: "Delete one notification" }));

export const PurgeNotificationsDocs = () =>
  applyDecorators(
    ApiQuery({
      name: "scope",
      required: false,
      enum: ["read", "all"],
      description: "`read` (default) empties what has been opened; `all` empties the whole history, unread included",
    }),
    ApiOperation({
      summary: "Empty the caller's notification history",
      description: "Bounded to the authenticated account, and answers with the same feed as the other write routes.",
    })
  );

export const GetNotificationPreferencesDocs = () =>
  applyDecorators(ApiOperation({ summary: "Read the caller's per-source notification channels" }));

export const UpdateNotificationPreferencesDocs = () =>
  applyDecorators(ApiOperation({ summary: "Enable or disable the in-app and email channels for one source" }));
