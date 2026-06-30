import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { IsRootGuard } from "../../core/guards/is-root.guard";
import {
  AcceptInvitationDocs,
  AccountsApi,
  GetAclDocs,
  GetInvitationDocs,
  ListAccountsDocs,
  RevokeAccountDocs,
  SendInvitationDocs,
  SetAclDocs,
} from "./accounts.openapi";
import { AccountsService } from "./accounts.service";
import {
  AcceptInvitationDto,
  SendInvitationDto,
  SetAclDto,
  acceptInvitationSchema,
  sendInvitationSchema,
  setAclSchema,
} from "./accounts.validation";

type AuthedRequest = Request & { user: { id: number; username: string; isRoot: boolean } };

@AccountsApi()
@Controller({ path: "accounts", version: "1" })
export class AccountsController {
  constructor(private readonly svc: AccountsService) {}

  @Get()
  @ListAccountsDocs()
  @UseGuards(AuthGuard("jwt"), IsRootGuard)
  list() {
    return this.svc.list();
  }

  @Delete(":id")
  @RevokeAccountDocs()
  @UseGuards(AuthGuard("jwt"), IsRootGuard)
  revoke(@Param("id", ParseIntPipe) id: number) {
    return this.svc.revokeAccount(id);
  }

  @Get(":id/acl")
  @GetAclDocs()
  @UseGuards(AuthGuard("jwt"), IsRootGuard)
  getAcl(@Param("id", ParseIntPipe) id: number) {
    return this.svc.getAcl(id);
  }

  @Put(":id/acl")
  @SetAclDocs()
  @UseGuards(AuthGuard("jwt"), IsRootGuard)
  setAcl(@Param("id", ParseIntPipe) id: number, @Body(new ZodValidationPipe(setAclSchema)) body: SetAclDto) {
    return this.svc.setAcl(id, body);
  }

  @Post("invite")
  @SendInvitationDocs()
  @UseGuards(AuthGuard("jwt"), IsRootGuard)
  sendInvitation(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(sendInvitationSchema)) body: SendInvitationDto) {
    return this.svc.sendInvitation(req.user.id, body);
  }

  @Get("invite/:token")
  @GetInvitationDocs()
  getInvitation(@Param("token") token: string) {
    return this.svc.getInvitation(token);
  }

  @Post("invite/:token/accept")
  @AcceptInvitationDocs()
  acceptInvitation(
    @Param("token") token: string,
    @Body(new ZodValidationPipe(acceptInvitationSchema)) body: AcceptInvitationDto
  ) {
    return this.svc.acceptInvitation(token, body);
  }
}
