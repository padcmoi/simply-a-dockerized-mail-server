import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { Public } from "../../core/auth/auth.decorator";
import { IsRootGuard } from "../../core/guards/is-root.guard";
import {
  AcceptInvitationDocs,
  AccountsApi,
  GetInvitationDocs,
  ListAccountNamesDocs,
  ListAccountsDocs,
  RevokeAccountDocs,
  SendInvitationDocs,
} from "./accounts.openapi";
import { AccountsService } from "./accounts.service";
import { AcceptInvitationDto, SendInvitationDto, acceptInvitationSchema, sendInvitationSchema } from "./accounts.validation";

type AuthedRequest = Request & {
  user: { id: number; username: string; isRoot: boolean };
};

@AccountsApi()
@Controller({ path: "accounts", version: "1" })
export class AccountsController {
  constructor(private readonly svc: AccountsService) {}

  @Get("names")
  @ListAccountNamesDocs()
  listNames() {
    return this.svc.listNames();
  }

  @Get()
  @ListAccountsDocs()
  @UseGuards(IsRootGuard)
  list() {
    return this.svc.list();
  }

  @Delete(":id")
  @RevokeAccountDocs()
  @UseGuards(IsRootGuard)
  revoke(@Param("id", ParseIntPipe) id: number) {
    return this.svc.revokeAccount(id);
  }

  @Post("invite")
  @SendInvitationDocs()
  @UseGuards(IsRootGuard)
  sendInvitation(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(sendInvitationSchema)) body: SendInvitationDto) {
    return this.svc.sendInvitation(req.user.id, body);
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
