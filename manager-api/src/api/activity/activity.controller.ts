import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ActivityLogService } from "../../core/activity/activity-log.service";
import { activityListQuerySchema, type ActivityListQuery } from "../../core/activity/activity-log.validation";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../core/custom-permission-guard/require-permissions.decorator";
import { ActivityApi, AllActivityDocs } from "./activity.openapi";

// The server's view of the journal: everyone's lines. Reading what every
// account does is supervision of the installation, so it sits under that
// resource, behind an action of its own.
@ActivityApi()
@Controller({ path: "activity", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityLogService) {}

  @Get()
  @RequireGlobalPermissions([{ resource: "supervision", actions: ["access", "view-activity-log"] }])
  @AllActivityDocs()
  list(@Query(new ZodValidationPipe(activityListQuerySchema)) query: ActivityListQuery) {
    return this.activity.listAll(query);
  }
}
