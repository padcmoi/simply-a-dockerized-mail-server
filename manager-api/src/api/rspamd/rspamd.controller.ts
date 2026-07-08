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

  @RequireGlobalPermissions([{ resource: "rspamd", actions: ["access", "read"] }])
  @GetActionsDocs()
  @Get("actions")
  getActions() {
    return this.rspamd.getActions();
  }

  // Gated more strictly than every other rspamd endpoint (access+read):
  // a bad threshold here can silently break spam filtering server-wide,
  // so this requires modify AND delete, not just modify.
  @RequireGlobalPermissions([{ resource: "rspamd", actions: ["access", "modify", "delete"] }])
  @SaveActionsDocs()
  @Patch("actions")
  saveActions(@Body(new ZodValidationPipe(saveRspamdActionsSchema)) body: SaveRspamdActionsDto) {
    return this.rspamd.saveActions(body);
  }

  // Same gate as the save endpoint above -- resetting is just re-saving
  // this project's shipped baseline (RSPAMD_FACTORY_ACTIONS), not a lesser
  // action than an arbitrary save.
  @RequireGlobalPermissions([{ resource: "rspamd", actions: ["access", "modify", "delete"] }])
  @ResetActionsDocs()
  @Delete("actions")
  resetActions() {
    return this.rspamd.resetActions();
  }
}
