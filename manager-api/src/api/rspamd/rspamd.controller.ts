import { Body, Controller, Delete, Get, Patch, Query, UseGuards } from "@nestjs/common";
import { paginationQuerySchema, type PaginationQuery } from "../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../core/custom-permission-guard/require-permissions.decorator";
import type { RspamdStats } from "../../core/rspamd/rspamd.service";
import { RspamdService } from "../../core/rspamd/rspamd.service";
import { GetActionsDocs, GetHistoryDocs, GetStatsDocs, ResetActionsDocs, RspamdApi, SaveActionsDocs } from "./rspamd.openapi";
import { saveRspamdActionsSchema, type SaveRspamdActionsDto } from "./rspamd.validation";

export type { RspamdStats };

@RspamdApi()
@Controller({ path: "rspamd", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class RspamdController {
  constructor(private readonly rspamd: RspamdService) {}

  @RequireGlobalPermissions([{ resource: "rspamd", actions: ["access", "view-rspamd-stats"] }])
  @GetStatsDocs()
  @Get("stats")
  stats() {
    return this.rspamd.stats();
  }

  @RequireGlobalPermissions([{ resource: "rspamd", actions: ["access", "view-rspamd-history"] }])
  @GetHistoryDocs()
  @Get("history")
  history(
    @Query("domain") domain: string | undefined,
    @Query("size") size: string | undefined,
    @Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery
  ) {
    return this.rspamd.history(domain, size ? parseInt(size, 10) : undefined, query);
  }

  @RequireGlobalPermissions([{ resource: "rspamd", actions: ["access", "view-rspamd-thresholds"] }])
  @GetActionsDocs()
  @Get("actions")
  getActions() {
    return this.rspamd.getActions();
  }

  // Writing arbitrary thresholds is unbounded: a bad value here silently breaks
  // spam filtering server-wide. Its own action, held by nobody by default.
  @RequireGlobalPermissions([{ resource: "rspamd", actions: ["access", "edit-rspamd-thresholds"] }])
  @SaveActionsDocs()
  @Patch("actions")
  saveActions(@Body(new ZodValidationPipe(saveRspamdActionsSchema)) body: SaveRspamdActionsDto) {
    return this.rspamd.saveActions(body);
  }

  // Deliberately NOT the same action as the save above, now that actions can be
  // named for what they do. Resetting only ever writes this project's shipped
  // baseline (RSPAMD_FACTORY_ACTIONS): its outcome is bounded and known, where
  // an arbitrary save is neither. Separating them lets an operator hand out
  // "restore the defaults" without handing out "tune the filter".
  @RequireGlobalPermissions([{ resource: "rspamd", actions: ["access", "reset-rspamd-thresholds"] }])
  @ResetActionsDocs()
  @Delete("actions")
  resetActions() {
    return this.rspamd.resetActions();
  }
}
