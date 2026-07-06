import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { paginationQuerySchema, type PaginationQuery } from "../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { Public } from "../../core/auth/auth.decorator";
import { IsRootGuard } from "../../core/guards/is-root.guard";
import {
  AcceptInvitationDocs,
  AccountsApi,
  GetAccountDocs,
  GetInvitationDocs,
  ListAccountNamesDocs,
  ListAccountsDocs,
  RevokeAccountDocs,
  SendInvitationDocs,
  UpdateAccountDocs,
} from "./accounts.openapi";
import { AccountsService } from "./accounts.service";
import {
  AcceptInvitationDto,
  SendInvitationDto,
  UpdateAccountDto,
  acceptInvitationSchema,
  sendInvitationSchema,
  updateAccountSchema,
} from "./accounts.validation";

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
  list(@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery) {
    return this.svc.list(query);
  }

  @Get(":id")
  @GetAccountDocs()
  @UseGuards(IsRootGuard)
  getById(@Param("id", ParseIntPipe) id: number) {
    return this.svc.getById(id);
  }

  @Patch(":id")
  @UpdateAccountDocs()
  @UseGuards(IsRootGuard)
  update(@Param("id", ParseIntPipe) id: number, @Body(new ZodValidationPipe(updateAccountSchema)) body: UpdateAccountDto) {
    return this.svc.updateAccount(id, body);
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
