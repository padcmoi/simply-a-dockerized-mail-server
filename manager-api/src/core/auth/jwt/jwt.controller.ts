import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Request } from "express";
import { In, Repository } from "typeorm";
import { PaginationQuery, paginationQuerySchema } from "../../common/pagination.validation";
import { ZodValidationPipe } from "../../common/zod.pipe";
import { CustomPermissionGuardService } from "../../custom-permission-guard/custom-permission-guard.service";
import { VirtualAlias } from "../../entities/virtual-alias.entity";
import { VirtualDomain } from "../../entities/virtual-domain.entity";
import { VirtualQuotaUser } from "../../entities/virtual-quota-user.entity";
import { VirtualUser } from "../../entities/virtual-user.entity";
import { Public } from "../auth.decorator";
import {
  JwtAuthApi,
  JwtChangePasswordDocs,
  JwtLoginDocs,
  JwtLogoutDocs,
  JwtMeDocs,
  JwtMeOverviewDocs,
  JwtMePermissionsDocs,
  JwtMeSessionHistoryDocs,
  JwtMeSessionsDocs,
  JwtMyGroupPermissionsDocs,
  JwtRefreshDocs,
  JwtRevokeSessionDocs,
  JwtUpdateProfileDocs,
} from "./jwt.openapi";
import { JwtAuthService } from "./jwt.service";
import {
  ChangeMyPasswordDto,
  LoginDto,
  RefreshDto,
  UpdateProfileDto,
  changeMyPasswordSchema,
  loginSchema,
  refreshSchema,
  updateProfileSchema,
} from "./jwt.validation";

type AuthedRequest = Request & {
  user: { id: string; email: string; isRoot: boolean };
};

@JwtAuthApi()
@Controller({ path: "auth/jwt", version: "1" })
export class JwtAuthController {
  constructor(
    private readonly auth: JwtAuthService,
    private readonly cpg: CustomPermissionGuardService,
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>,
    @InjectRepository(VirtualUser) private readonly virtualUsers: Repository<VirtualUser>,
    @InjectRepository(VirtualAlias) private readonly virtualAliases: Repository<VirtualAlias>,
    @InjectRepository(VirtualQuotaUser) private readonly recipientQuotas: Repository<VirtualQuotaUser>
  ) {}

  // Resolves each domain-scoped permission's domainId to its FQDN, server-side,
  // so a self-scoped caller sees the real domain name even for a domain it does
  // not own (its group may carry a permission on a domain it cannot otherwise
  // list). Falls back to "#<id>" for a since-deleted domain.
  private async withDomainNames<T extends { domainId: number }>(rows: T[]) {
    const ids = [...new Set(rows.map((r) => r.domainId))];
    const found = ids.length ? await this.domains.findBy({ id: In(ids) }) : [];
    const names = new Map(found.map((d) => [d.id, d.domain]));
    return rows.map((r) => ({ ...r, domainName: names.get(r.domainId) ?? `#${r.domainId}` }));
  }

  @Post("login")
  @Public()
  @HttpCode(200)
  @JwtLoginDocs()
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginDto,
    @Headers("user-agent") ua: string | undefined,
    @Ip() ip: string
  ) {
    return this.auth.login(body.email, body.password, ua, ip);
  }

  @Post("refresh")
  @Public()
  @HttpCode(200)
  @JwtRefreshDocs()
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshDto,
    @Headers("user-agent") ua: string | undefined,
    @Ip() ip: string
  ) {
    return this.auth.refresh(body.refreshToken, ua, ip);
  }

  @Post("logout")
  @Public()
  @HttpCode(200)
  @JwtLogoutDocs()
  async logout(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshDto) {
    await this.auth.revoke(body.refreshToken);
    return { ok: true };
  }

  @Get("me")
  @JwtMeDocs()
  me(@Req() req: AuthedRequest) {
    return this.auth.me(req.user.id);
  }

  // Self-scoped overview: the domains, recipients and aliases the caller owns
  // (owner_id on virtual_domains / virtual_users / virtual_aliases). Powers the
  // personal space (/me) and the profile "what you own" section; same shape as
  // the admin GET /accounts/:id/overview, minus the account block the caller
  // already has from GET /me.
  @Get("me/overview")
  @JwtMeOverviewDocs()
  async meOverview(@Req() req: AuthedRequest) {
    const [domains, recipients, aliases] = await Promise.all([
      this.domains.find({ where: { ownerId: req.user.id }, order: { domain: "ASC" } }),
      this.virtualUsers.find({ where: { ownerId: req.user.id }, order: { email: "ASC" } }),
      this.virtualAliases.find({ where: { ownerId: req.user.id }, order: { source: "ASC" } }),
    ]);
    const usedByEmail = new Map<string, string>();
    if (recipients.length) {
      const rows = await this.recipientQuotas.find({ where: { email: In(recipients.map((r) => r.email)) } });
      rows.forEach((row) => usedByEmail.set(row.email, row.bytes));
    }
    return {
      domains: domains.map((d) => ({ id: d.id, domain: d.domain, active: d.active === 1, quota: d.quota })),
      recipients: recipients.map((r) => ({
        id: r.id,
        email: r.email,
        domain: r.domain,
        active: r.active === 1,
        quota: r.quota,
        usedBytes: usedByEmail.get(r.email) ?? "0",
      })),
      aliases: aliases.map((a) => ({ id: a.id, source: a.source, destination: a.destination, domain: a.domain })),
    };
  }

  @Patch("me")
  @JwtUpdateProfileDocs()
  updateProfile(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileDto) {
    return this.auth.updateProfile(req.user.id, body);
  }

  @Patch("me/password")
  @JwtChangePasswordDocs()
  changePassword(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(changeMyPasswordSchema)) body: ChangeMyPasswordDto) {
    return this.auth.changePassword(req.user.id, body);
  }

  @Get("me/sessions")
  @JwtMeSessionsDocs()
  meSessions(@Req() req: AuthedRequest) {
    return this.auth.listActiveSessions(req.user.id);
  }

  @Get("me/sessions/history")
  @JwtMeSessionHistoryDocs()
  meSessionHistory(@Req() req: AuthedRequest, @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery) {
    return this.auth.listSessionHistory(req.user.id, query);
  }

  @Delete("me/sessions/:id")
  @JwtRevokeSessionDocs()
  revokeSession(@Req() req: AuthedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.auth.revokeSession(req.user.id, id);
  }

  @Get("me/permissions")
  @JwtMePermissionsDocs()
  async mePermissions(@Req() req: AuthedRequest) {
    const eff = await this.cpg.guard.getEffectivePermissions(req.user.id);
    return { global: eff.global, domain: await this.withDomainNames(eff.domain) };
  }

  // Self-scoped, membership-gated: lets a member inspect what their OWN group
  // grants, even when the group is invisible (hidden from /groups everywhere
  // else). Root may read any group. The only gate is membership, deliberately
  // NOT the invisible flag: this is the single sanctioned window onto an
  // invisible group's contents, for the accounts that actually carry them.
  @Get("me/groups/:id/permissions")
  @JwtMyGroupPermissionsDocs()
  async myGroupPermissions(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string) {
    if (!req.user.isRoot) {
      const memberIds = await this.cpg.guard.findGroupMemberIds(id);
      if (!memberIds.map(String).includes(req.user.id)) {
        throw new ForbiddenException("You are not a member of this group");
      }
    }
    const [globalPermissions, rawDomain] = await Promise.all([
      this.cpg.guard.findGroupGlobalPermissions(id),
      this.cpg.guard.findGroupDomainPermissions(id),
    ]);
    return { globalPermissions, domainPermissions: await this.withDomainNames(rawDomain) };
  }
}
