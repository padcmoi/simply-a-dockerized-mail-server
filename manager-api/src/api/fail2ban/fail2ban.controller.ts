import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { ActivityLogService } from "../../core/activity/activity-log.service";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../core/custom-permission-guard/require-permissions.decorator";
import { BanIpDocs, Fail2banApi, Fail2banStatusDocs, UnbanIpDocs } from "./fail2ban.openapi";
import { Fail2banService } from "../../core/fail2ban/fail2ban.service";
import { fail2banIpBodySchema, fail2banJailSchema, type Fail2banIpBody } from "./fail2ban.validation";

@Fail2banApi()
@Controller({ path: "fail2ban", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class Fail2banController {
  constructor(
    private readonly fail2ban: Fail2banService,
    private readonly activity: ActivityLogService
  ) {}

  @Get("jails")
  @RequireGlobalPermissions([{ resource: "fail2ban", actions: ["access", "view-fail2ban-jails"] }])
  @Fail2banStatusDocs()
  jails() {
    return this.fail2ban.status();
  }

  @Post("ban")
  @HttpCode(200)
  @RequireGlobalPermissions([{ resource: "fail2ban", actions: ["access", "ban-ip"] }])
  @BanIpDocs()
  async ban(@Body(new ZodValidationPipe(fail2banIpBodySchema)) body: Fail2banIpBody) {
    const jail = await this.fail2ban.ban(body.ip);
    await this.activity.record({
      action: "fail2ban.banned",
      entity: { type: "ip", label: body.ip },
      details: { jail: jail.name },
    });
    return jail;
  }

  @Post("jails/:jail/unban")
  @HttpCode(200)
  @RequireGlobalPermissions([{ resource: "fail2ban", actions: ["access", "unban-ip"] }])
  @UnbanIpDocs()
  async unban(
    @Param("jail", new ZodValidationPipe(fail2banJailSchema)) jail: string,
    @Body(new ZodValidationPipe(fail2banIpBodySchema)) body: Fail2banIpBody
  ) {
    const after = await this.fail2ban.unban(jail, body.ip);
    await this.activity.record({ action: "fail2ban.unbanned", entity: { type: "ip", label: body.ip }, details: { jail } });
    return after;
  }
}
