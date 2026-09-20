import { Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ActivityLogService } from "../../core/activity/activity-log.service";
import { ClamavService } from "../../core/clamav/clamav.service";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../core/custom-permission-guard/require-permissions.decorator";
import { ClamavApi, ClamavReloadDocs, ClamavStatusDocs, ClamavUpdateDocs } from "./clamav.openapi";

@ClamavApi()
@Controller({ path: "clamav", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class ClamavController {
  constructor(
    private readonly clamav: ClamavService,
    private readonly activity: ActivityLogService
  ) {}

  @Get("status")
  @RequireGlobalPermissions([{ resource: "clamav", actions: ["access", "view-clamav-status"] }])
  @ClamavStatusDocs()
  status() {
    return this.clamav.status();
  }

  // Written to the journal, like every action taken from the manager: the
  // hourly download freshclam does on its own has nothing to do there, a
  // person asking for one does.
  @Post("update")
  @HttpCode(200)
  @RequireGlobalPermissions([{ resource: "clamav", actions: ["access", "update-signatures"] }])
  @ClamavUpdateDocs()
  async update() {
    const result = await this.clamav.update();
    await this.activity.record({
      action: "clamav.updated",
      entity: { type: "service", label: "clamav" },
      details: { updated: result.updated },
    });
    return result;
  }

  @Post("reload")
  @HttpCode(200)
  @RequireGlobalPermissions([{ resource: "clamav", actions: ["access", "reload-database"] }])
  @ClamavReloadDocs()
  async reload() {
    const result = await this.clamav.reload();
    await this.activity.record({ action: "clamav.reloaded", entity: { type: "service", label: "clamav" } });
    return result;
  }
}
