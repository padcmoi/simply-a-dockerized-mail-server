import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { ZodValidationPipe } from "../../../core/common/zod.pipe";
import { DomainPermissionGuard } from "../../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireDomainPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import {
  CreateDelegationTokenDocs,
  DelegationsApi,
  EditDelegationInviteDocs,
  InviteDelegationDocs,
  ListDelegationsDocs,
  RevokeDelegationDocs,
  RevokeDelegationInviteDocs,
  SetDelegationCapsDocs,
} from "./delegations.openapi";
import { DelegationsService } from "./delegations.service";
import {
  CreateDelegationTokenDto,
  createDelegationTokenSchema,
  DelegationCapsDto,
  delegationCapsSchema,
  EditDelegationInviteDto,
  editDelegationInviteSchema,
  InviteDelegationDto,
  inviteDelegationSchema,
} from "./delegations.validation";

type AuthedRequest = Request & {
  user: { id: string; email: string; isRoot: boolean };
};

function baseUrlOf(req: AuthedRequest): string {
  const fwdProto = req.headers["x-forwarded-proto"];
  const fwdHost = req.headers["x-forwarded-host"];
  const proto = (Array.isArray(fwdProto) ? fwdProto[0] : fwdProto)?.split(",")[0]?.trim() || req.protocol;
  const host = (Array.isArray(fwdHost) ? fwdHost[0] : fwdHost)?.split(",")[0]?.trim() || req.get("host") || "";
  return `${proto}://${host}`;
}

// The dedicated delegation menu of a domain. Reachable by the domain owner
// (the guard's ownership bypass) or by any account granted the existing
// creation actions on this domain: handing an allowance out requires the same
// rights as creating the resources yourself.
@DelegationsApi()
@Controller({ path: "domains/:domainId/delegations", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class DelegationsController {
  constructor(private readonly svc: DelegationsService) {}

  @Get()
  @RequireDomainPermissions([
    { resource: "recipients", actions: ["access", "create-recipient"] },
    { resource: "aliases", actions: ["access", "create-alias"] },
  ])
  @ListDelegationsDocs()
  list(@Param("domainId", ParseIntPipe) domainId: number) {
    return this.svc.listForDomain(domainId);
  }

  @Post("invite")
  @RequireDomainPermissions([
    { resource: "recipients", actions: ["access", "create-recipient"] },
    { resource: "aliases", actions: ["access", "create-alias"] },
  ])
  @InviteDelegationDocs()
  invite(
    @Req() req: AuthedRequest,
    @Param("domainId", ParseIntPipe) domainId: number,
    @Body(new ZodValidationPipe(inviteDelegationSchema)) body: InviteDelegationDto
  ) {
    return this.svc.grantOrInvite(req.user.id, domainId, body, baseUrlOf(req));
  }

  @Post("token")
  @RequireDomainPermissions([
    { resource: "recipients", actions: ["access", "create-recipient"] },
    { resource: "aliases", actions: ["access", "create-alias"] },
  ])
  @CreateDelegationTokenDocs()
  createToken(
    @Req() req: AuthedRequest,
    @Param("domainId", ParseIntPipe) domainId: number,
    @Body(new ZodValidationPipe(createDelegationTokenSchema)) body: CreateDelegationTokenDto
  ) {
    return this.svc.createToken(req.user.id, domainId, body, baseUrlOf(req));
  }

  @Put("invitations/:invitationId")
  @RequireDomainPermissions([
    { resource: "recipients", actions: ["access", "create-recipient"] },
    { resource: "aliases", actions: ["access", "create-alias"] },
  ])
  @EditDelegationInviteDocs()
  editInvitation(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Param("invitationId", ParseIntPipe) invitationId: number,
    @Body(new ZodValidationPipe(editDelegationInviteSchema)) body: EditDelegationInviteDto
  ) {
    return this.svc.editInvitation(domainId, invitationId, body);
  }

  @Delete("invitations/:invitationId")
  @RequireDomainPermissions([
    { resource: "recipients", actions: ["access", "create-recipient"] },
    { resource: "aliases", actions: ["access", "create-alias"] },
  ])
  @RevokeDelegationInviteDocs()
  revokeInvitation(@Param("domainId", ParseIntPipe) domainId: number, @Param("invitationId", ParseIntPipe) invitationId: number) {
    return this.svc.revokeInvitation(domainId, invitationId);
  }

  @Put(":accountId")
  @RequireDomainPermissions([
    { resource: "recipients", actions: ["access", "create-recipient"] },
    { resource: "aliases", actions: ["access", "create-alias"] },
  ])
  @SetDelegationCapsDocs()
  setCaps(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Param("accountId", ParseUUIDPipe) accountId: string,
    @Body(new ZodValidationPipe(delegationCapsSchema)) body: DelegationCapsDto
  ) {
    return this.svc.setCaps(domainId, accountId, body);
  }

  @Delete(":accountId")
  @RequireDomainPermissions([
    { resource: "recipients", actions: ["access", "create-recipient"] },
    { resource: "aliases", actions: ["access", "create-alias"] },
  ])
  @RevokeDelegationDocs()
  revoke(@Param("domainId", ParseIntPipe) domainId: number, @Param("accountId", ParseUUIDPipe) accountId: string) {
    return this.svc.revoke(domainId, accountId);
  }
}
