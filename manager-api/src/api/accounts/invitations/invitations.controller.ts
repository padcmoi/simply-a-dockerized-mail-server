import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { ZodValidationPipe } from "../../../core/common/zod.pipe";
import { Public } from "../../../core/auth/auth.decorator";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import { AccountsApi } from "../crud/crud.openapi";
import { AcceptInvitationDocs, GetInvitationDocs, SendInvitationDocs } from "./invitations.openapi";
import { AccountsInvitationsService } from "./invitations.service";
import { AcceptInvitationDto, SendInvitationDto, acceptInvitationSchema, sendInvitationSchema } from "./invitations.validation";

type AuthedRequest = Request & {
  user: { id: string; email: string; isRoot: boolean };
};

@AccountsApi()
@Controller({ path: "accounts", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class AccountsInvitationsController {
  constructor(private readonly svc: AccountsInvitationsService) {}

  @Post("invite")
  @RequireGlobalPermissions([{ resource: "accounts", actions: ["access", "invite-account"] }])
  @SendInvitationDocs()
  sendInvitation(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(sendInvitationSchema)) body: SendInvitationDto) {
    // Build the invite link from the real host the admin is on (behind the
    // reverse proxy), never a hard-coded/env default -- so it never points to
    // example.com.
    const fwdProto = req.headers["x-forwarded-proto"];
    const fwdHost = req.headers["x-forwarded-host"];
    const proto = (Array.isArray(fwdProto) ? fwdProto[0] : fwdProto)?.split(",")[0]?.trim() || req.protocol;
    const host = (Array.isArray(fwdHost) ? fwdHost[0] : fwdHost)?.split(",")[0]?.trim() || req.get("host") || "";
    return this.svc.sendInvitation(req.user, body, `${proto}://${host}`);
  }

  @Get("invite/:token")
  @Public()
  @GetInvitationDocs()
  getInvitation(@Param("token") token: string) {
    return this.svc.getInvitation(token);
  }

  @Post("invite/:token/accept")
  @Public()
  @AcceptInvitationDocs()
  acceptInvitation(
    @Param("token") token: string,
    @Body(new ZodValidationPipe(acceptInvitationSchema))
    body: AcceptInvitationDto
  ) {
    return this.svc.acceptInvitation(token, body);
  }
}
