import { applyDecorators } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ApiPaginationQuery } from "../../core/common/pagination.openapi";

export const NotificationsApi = () => applyDecorators(ApiTags("notifications"), ApiSecurity("apiToken"));

const idParam = () => ApiParam({ name: "id", type: Number, example: 1, description: "Notification id" });

export const ListNotificationsDocs = () =>
  applyDecorators(ApiPaginationQuery(["createdAt"]), ApiOperation({ summary: "List the caller's own notifications" }));

export const NotificationFeedDocs = () =>
  applyDecorators(ApiOperation({ summary: "Unread count and latest notifications of the caller" }));

export const MarkNotificationReadDocs = () => applyDecorators(idParam(), ApiOperation({ summary: "Mark one notification read" }));

export const MarkAllNotificationsReadDocs = () =>
  applyDecorators(ApiOperation({ summary: "Mark every notification of the caller read" }));

export const DeleteNotificationDocs = () => applyDecorators(idParam(), ApiOperation({ summary: "Delete one notification" }));

export const GetNotificationPreferencesDocs = () =>
  applyDecorators(ApiOperation({ summary: "Read the caller's per-source notification channels" }));

export const UpdateNotificationPreferencesDocs = () =>
  applyDecorators(ApiOperation({ summary: "Enable or disable the in-app and email channels for one source" }));
