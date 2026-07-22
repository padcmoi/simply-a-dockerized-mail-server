import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { paginationQuerySchema, type PaginationQuery } from "../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { NotificationsService } from "../../core/notifications/notifications.service";
import {
  DeleteNotificationDocs,
  GetNotificationPreferencesDocs,
  ListNotificationsDocs,
  MarkAllNotificationsReadDocs,
  MarkNotificationReadDocs,
  NotificationFeedDocs,
  NotificationsApi,
  UpdateNotificationPreferencesDocs,
} from "./notifications.openapi";
import { UpdatePreferenceDto, updatePreferenceSchema } from "./notifications.validation";

type AuthedRequest = Request & {
  user: { id: string; email: string; isRoot: boolean };
};

@NotificationsApi()
@Controller({ path: "notifications", version: "1" })
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  @ListNotificationsDocs()
  list(@Req() req: AuthedRequest, @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery) {
    return this.svc.list(req.user.id, query);
  }

  @Get("feed")
  @NotificationFeedDocs()
  feed(@Req() req: AuthedRequest) {
    return this.svc.feed(req.user.id);
  }

  @Get("preferences")
  @GetNotificationPreferencesDocs()
  preferences(@Req() req: AuthedRequest) {
    return this.svc.preferencesFor(req.user.id);
  }

  @Put("preferences")
  @UpdateNotificationPreferencesDocs()
  updatePreferences(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(updatePreferenceSchema)) body: UpdatePreferenceDto) {
    return this.svc.setPreference(req.user.id, body.source, { inApp: body.inApp, email: body.email });
  }

  @Post("read-all")
  @MarkAllNotificationsReadDocs()
  markAllRead(@Req() req: AuthedRequest) {
    return this.svc.markAllRead(req.user.id);
  }

  @Post(":id/read")
  @MarkNotificationReadDocs()
  markRead(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.markRead(req.user.id, id);
  }

  @Delete(":id")
  @DeleteNotificationDocs()
  remove(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.remove(req.user.id, id);
  }
}
