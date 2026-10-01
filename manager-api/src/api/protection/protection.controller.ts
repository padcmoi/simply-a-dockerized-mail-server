import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  HttpCode,
  Param,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { ActivityLogService } from "../../core/activity/activity-log.service";
import { RootGuard } from "../../core/auth/root.guard";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../core/custom-permission-guard/require-permissions.decorator";
import { PROTECTABLE_TYPES, ProtectionService, type ProtectableType } from "../../core/protection/protection.service";
import { ProtectDocs, ProtectionApi, UnprotectDocs } from "./protection.openapi";

const RESOURCE_ID = /^[0-9A-Za-z-]{1,64}$/;
const ROOT_ONLY: ProtectableType[] = ["account", "domain"];

type AuthedRequest = Request & { user: { isRoot: boolean } };

@ProtectionApi()
@Controller({ path: "protection", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class ProtectionController {
  constructor(
    private readonly protection: ProtectionService,
    private readonly activity: ActivityLogService
  ) {}

  @Put(":type/:id")
  @HttpCode(204)
  @RequireGlobalPermissions([{ resource: "misc", actions: ["access", "protect-resource"] }])
  @ProtectDocs()
  async protect(@Param("type") type: string, @Param("id") id: string, @Req() req: AuthedRequest) {
    const resource = this.resourceOf(type, id);
    if (ROOT_ONLY.includes(resource) && !req.user.isRoot) {
      throw new ForbiddenException(`Only a root account can protect this ${resource}`);
    }
    const label = await this.protection.setProtected(resource, id, true);
    await this.activity.record({ action: "protection.enabled", entity: { type: resource, id, label } });
  }

  @Delete(":type/:id")
  @HttpCode(204)
  @UseGuards(RootGuard)
  @UnprotectDocs()
  async unprotect(@Param("type") type: string, @Param("id") id: string) {
    const resource = this.resourceOf(type, id);
    const label = await this.protection.setProtected(resource, id, false);
    await this.activity.record({ action: "protection.disabled", entity: { type: resource, id, label } });
  }

  private resourceOf(type: string, id: string): ProtectableType {
    if (!(PROTECTABLE_TYPES as readonly string[]).includes(type)) throw new BadRequestException("Unknown resource type");
    if (!RESOURCE_ID.test(id)) throw new BadRequestException("Invalid resource id");
    return type as ProtectableType;
  }
}
