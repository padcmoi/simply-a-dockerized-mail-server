import { Controller, Get, UseGuards } from "@nestjs/common";
import { ClamavService } from "../../core/clamav/clamav.service";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../core/custom-permission-guard/require-permissions.decorator";
import { ClamavApi, ClamavStatusDocs } from "./clamav.openapi";

@ClamavApi()
@Controller({ path: "clamav", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class ClamavController {
  constructor(private readonly clamav: ClamavService) {}

  @Get("status")
  @RequireGlobalPermissions([{ resource: "clamav", actions: ["access", "view-clamav-status"] }])
  @ClamavStatusDocs()
  status() {
    return this.clamav.status();
  }
}
