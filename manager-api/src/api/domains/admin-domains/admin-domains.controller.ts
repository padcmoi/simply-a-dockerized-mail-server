import { Body, Controller, Delete, Param, ParseIntPipe, Patch, UseGuards } from "@nestjs/common";
import { ZodValidationPipe } from "../../../core/common/zod.pipe";
import { DomainPermissionGuard } from "../../../core/custom-permission-guard/domain-permission.guard";
import { GlobalPermissionGuard } from "../../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../../core/custom-permission-guard/require-permissions.decorator";
import { AdminDomainsApi, RemoveDomainDocs, ResizeDomainQuotaDocs } from "./admin-domains.openapi";
import { DomainsService } from "../domains.service";
import { ResizeDomainQuotaDto, resizeDomainQuotaSchema } from "../domains.validation";

// Reserved for real server administrators, never domain owners: resizing a
// live domain's quota, or deleting it outright -- 2 single-purpose routes,
// one job each. There is deliberately no rename route, for anyone, at any
// permission tier: an FQDN is the domain's identity, embedded in every
// `virtual_users.email` / `maildir` and in the maildir tree on disk, none of
// which a rename would follow. Deliberately under its own "admin" URL prefix,
// separate from the domain-scoped /domains/:domainId surface (recipients/
// aliases/active/etc, where owner self-service is legitimate -- see
// DomainsController). Full CRUD on the GLOBAL "domains" resource (no
// ownership bypass exists at that tier, see @naskot/custom-permission-guard's
// service.md) AND domain:access+modify/delete on this specific domainId.
@AdminDomainsApi()
@Controller({ path: "admin/domains", version: "1" })
@UseGuards(GlobalPermissionGuard, DomainPermissionGuard)
export class AdminDomainsController {
  constructor(private readonly svc: DomainsService) {}

  @Patch(":domainId/quota")
  @RequireGlobalPermissions([
    { resource: "domains", actions: ["access"] },
    { resource: "superadmin", actions: ["access", "read", "modify"] },
  ])
  @ResizeDomainQuotaDocs()
  resizeQuota(
    @Param("domainId", ParseIntPipe) domainId: number,
    @Body(new ZodValidationPipe(resizeDomainQuotaSchema)) body: ResizeDomainQuotaDto
  ) {
    return this.svc.update(domainId, body);
  }

  @Delete(":domainId")
  @RequireGlobalPermissions([
    { resource: "domains", actions: ["access"] },
    { resource: "superadmin", actions: ["access", "read", "delete"] },
  ])
  @RemoveDomainDocs()
  remove(@Param("domainId", ParseIntPipe) domainId: number) {
    return this.svc.remove(domainId);
  }
}
