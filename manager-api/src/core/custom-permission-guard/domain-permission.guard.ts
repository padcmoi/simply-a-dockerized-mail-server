import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectRepository } from "@nestjs/typeorm";
import { CustomPermissionGuardConfigError } from "@naskot/custom-permission-guard";
import type { Request } from "express";
import { Repository } from "typeorm";
import { VirtualDomain } from "../entities/virtual-domain.entity";
import { CustomPermissionGuardService } from "./custom-permission-guard.service";
import { PermissionRequirement, REQUIRE_DOMAIN_PERMISSIONS_KEY } from "./require-permissions.decorator";

type PermissionRequest = Request & {
  user?: { id: number; username: string; isRoot: boolean };
};

// Turns a throw-on-forbidden assertOne call into a boolean, without ever
// swallowing a real misconfiguration (unknown resource/action/customName,
// or a disabled authorizedPermissions dimension) -- exactly the pattern
// docs/nestjs.md and docs/express.md document for a consumer that needs a
// non-throwing check.
async function isGranted(fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (err) {
    if (err instanceof CustomPermissionGuardConfigError) throw err;
    return false;
  }
}

// Resolution order, strongest to weakest -- ported 1:1 from the previous
// hand-written DomainPermissionGuard (backend-acl-domain.md), only root and
// the lib's own primitives moved to where they belong:
//   1. root -> always passes (bypass lives here, never in the lib).
//   2. current account is virtual_domains.owner_id for the target domain ->
//      always passes, group_domain_permissions is never consulted.
//   3. the global "domains" resource acts as a system-wide override for the
//      domain-scoped "domain" resource specifically (the lib's own
//      bridgeFromGlobal, configured in custom-permission-guard.service.ts).
//      This does NOT extend to recipients/aliases/quotas/dkim/rspamd.
//   4. otherwise: a blanket global `domains:access` prerequisite for ANY
//      remaining domain-tier requirement (this is a mail-server-specific
//      rule, not expressible via the lib's dependsOn -- which is domain-tier
//      only and never reaches across to the global tier -- so it stays here,
//      not in schemas), + the domain-scoped `domain.access` gate for this
//      domain_id (the lib's dependsOn already covers this for
//      recipients/aliases/etc, this call is for the "domain" resource path
//      and mirrors the previous raw hasDomain check) + the remaining
//      (resource, action) pairs via the lib.
@Injectable()
export class DomainPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cpg: CustomPermissionGuardService,
    @InjectRepository(VirtualDomain) private readonly domains: Repository<VirtualDomain>
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionRequirement[] | undefined>(REQUIRE_DOMAIN_PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<PermissionRequest>();
    const user = req.user;
    if (!user) throw new ForbiddenException("Authentication required");
    if (user.isRoot === true) return true;

    const domainIdParam = req.params?.["domainId"];
    if (domainIdParam === undefined || !Number.isFinite(Number(domainIdParam))) {
      throw new Error(
        `@RequireDomainPermissions used on a route without a numeric :domainId param (${req.method} ${req.originalUrl})`
      );
    }
    const domainId = Number(domainIdParam);

    const domain = await this.domains.findOne({ where: { id: domainId } });
    if (domain && domain.ownerId === user.id) return true;

    const remaining: PermissionRequirement[] = [];
    for (const entry of required) {
      if (entry.resource !== "domain") {
        remaining.push(entry);
        continue;
      }
      const stillNeeded: string[] = [];
      for (const action of entry.actions) {
        const viaGlobal = await isGranted(() => this.cpg.guard.assertOne.global(user.id, "domains", { acrud: [action] }));
        if (!viaGlobal) stillNeeded.push(action);
      }
      if (stillNeeded.length) remaining.push({ resource: entry.resource, actions: stillNeeded });
    }
    if (!remaining.length) return true;

    const hasDomainsAccess = await isGranted(() => this.cpg.guard.assertOne.global(user.id, "domains", { acrud: ["access"] }));
    if (!hasDomainsAccess) throw new ForbiddenException("Missing permission domains:access");

    await this.cpg.guard.assertOne.domain(user.id, domainId, "domain", { acrud: ["access"] });

    for (const entry of remaining) {
      await this.cpg.guard.assertOne.domain(user.id, domainId, entry.resource, { acrud: entry.actions });
    }
    return true;
  }
}
