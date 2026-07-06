import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { paginationQuerySchema, type PaginationQuery } from "../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../core/custom-permission-guard/require-permissions.decorator";
import type { RspamdStats } from "../../core/rspamd/rspamd.service";
import { RspamdService } from "../../core/rspamd/rspamd.service";
import { GetHistoryDocs, GetStatsDocs, RspamdApi } from "./rspamd.openapi";

export type { RspamdStats };

@RspamdApi()
@Controller({ path: "rspamd", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class RspamdController {
  constructor(private readonly rspamd: RspamdService) {}

  @RequireGlobalPermissions([{ resource: "rspamd", actions: ["access", "read"] }])
  @GetStatsDocs()
  @Get("stats")
  stats() {
    return this.rspamd.stats();
  }

  @RequireGlobalPermissions([{ resource: "rspamd", actions: ["access", "read"] }])
  @GetHistoryDocs()
  @Get("history")
  history(
    @Query("domain") domain: string | undefined,
    @Query("size") size: string | undefined,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery
  ) {
    return this.rspamd.history(domain, size ? parseInt(size, 10) : undefined, query);
  }
}
