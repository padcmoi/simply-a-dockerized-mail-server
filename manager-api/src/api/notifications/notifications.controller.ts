import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Post, Put, Query, Req } from "@nestjs/common";
import type { Request } from "express";

import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { CustomPermissionGuardService } from "../../core/custom-permission-guard/custom-permission-guard.service";
import {
  NOTIFICATION_SOURCE_PERMISSIONS,
  NotificationsService,
  type NotificationChannels,
  type NotificationSource,
} from "../../core/notifications/notifications.service";
import {
  DeleteNotificationDocs,
  MarkNotificationUnreadDocs,
  PurgeNotificationsDocs,
  GetNotificationPreferencesDocs,
  ListNotificationsDocs,
  MarkAllNotificationsReadDocs,
  MarkNotificationReadDocs,
  NotificationFeedDocs,
  NotificationsApi,
  UpdateNotificationPreferencesDocs,
} from "./notifications.openapi";
import {
  NotificationListQuery,
  notificationListQuerySchema,
  PurgeNotificationsDto,
  purgeNotificationsSchema,
  UpdatePreferenceDto,
  updatePreferenceSchema,
} from "./notifications.validation";

type AuthedRequest = Request & {
  user: { id: string; email: string; isRoot: boolean };
};

@NotificationsApi()
@Controller({ path: "notifications", version: "1" })
export class NotificationsController {
  constructor(
    private readonly svc: NotificationsService,
    private readonly cpg: CustomPermissionGuardService
  ) {}

  private async allowedSources(user: AuthedRequest["user"]): Promise<(source: NotificationSource) => boolean> {
    if (user.isRoot) return () => true;
    const { global } = await this.cpg.guard.getEffectivePermissions(user.id);
    return (source) =>
      (NOTIFICATION_SOURCE_PERMISSIONS[source] ?? []).every((needed) =>
        global.some((p) => p.resource === needed.resource && p.action === needed.action)
      );
  }

  private async described(user: AuthedRequest["user"], preferences: Record<NotificationSource, NotificationChannels>) {
    const allowed = await this.allowedSources(user);
    return Object.fromEntries(
      Object.entries(preferences).map(([source, channels]) => [
        source,
        { ...channels, allowed: allowed(source as NotificationSource) },
      ])
    );
  }

  @Get()
  @ListNotificationsDocs()
  list(@Req() req: AuthedRequest, @Query(new ZodValidationPipe(notificationListQuerySchema)) query: NotificationListQuery) {
    return this.svc.list(req.user.id, query);
  }

  @Get("feed")
  @NotificationFeedDocs()
  feed(@Req() req: AuthedRequest) {
    return this.svc.feed(req.user.id);
  }

  @Get("preferences")
  @GetNotificationPreferencesDocs()
  async preferences(@Req() req: AuthedRequest) {
    return this.described(req.user, await this.svc.preferencesFor(req.user.id));
  }

  @Put("preferences")
  @UpdateNotificationPreferencesDocs()
  async updatePreferences(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(updatePreferenceSchema)) body: UpdatePreferenceDto
  ) {
    const current = await this.svc.channelsFor(req.user.id, body.source);
    const enabling = (body.inApp && !current.inApp) || (body.email && !current.email);
    if (enabling && !(await this.allowedSources(req.user))(body.source)) {
      throw new ForbiddenException("You cannot turn on a source whose pages you have no access to");
    }
    return this.described(
      req.user,
      await this.svc.setPreference(req.user.id, body.source, { inApp: body.inApp, email: body.email })
    );
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

  @Post(":id/unread")
  @MarkNotificationUnreadDocs()
  markUnread(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.markUnread(req.user.id, id);
  }

  // Declared before `:id`, which would otherwise never see a request without one
  // but would happily answer this path's absence of an id with a 400.
  @Delete()
  @PurgeNotificationsDocs()
  purge(@Req() req: AuthedRequest, @Query(new ZodValidationPipe(purgeNotificationsSchema)) query: PurgeNotificationsDto) {
    return this.svc.purge(req.user.id, query.scope);
  }

  @Delete(":id")
  @DeleteNotificationDocs()
  remove(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.svc.remove(req.user.id, id);
  }
}
