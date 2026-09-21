import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ActivityLogService } from "../../core/activity/activity-log.service";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import {
  RequireGlobalPermissions,
  type GlobalPermissionRequirement,
} from "../../core/custom-permission-guard/require-permissions.decorator";
import { DmarcService } from "../../core/dmarc/dmarc.service";
import {
  dmarcInboxQuerySchema,
  dmarcIncomingQuerySchema,
  dmarcOutgoingQuerySchema,
  dmarcRunSchema,
  dmarcSettingsSchema,
  type DmarcInboxQuery,
  type DmarcIncomingQuery,
  type DmarcOutgoingQuery,
  type DmarcRunDto,
  type DmarcSettingsDto,
} from "../../core/dmarc/dmarc.validation";
import {
  DmarcApi,
  DmarcInboxDocs,
  DmarcIncomingDocs,
  DmarcIncomingReportDocs,
  DmarcIncomingXmlDocs,
  DmarcMailboxesDocs,
  DmarcOutgoingDocs,
  DmarcOutgoingXmlDocs,
  DmarcOverviewDocs,
  DmarcRetryDocs,
  DmarcRunDocs,
  DmarcScanDocs,
  DmarcSettingsDocs,
  DmarcUpdateSettingsDocs,
} from "./dmarc.openapi";

const VIEW: GlobalPermissionRequirement[] = [{ resource: "dmarc", actions: ["access", "view-dmarc-reports"] }];
const SEND: GlobalPermissionRequirement[] = [{ resource: "dmarc", actions: ["access", "send-dmarc-reports"] }];
const IMPORT: GlobalPermissionRequirement[] = [{ resource: "dmarc", actions: ["access", "import-dmarc-reports"] }];
const MANAGE: GlobalPermissionRequirement[] = [{ resource: "dmarc", actions: ["access", "manage-dmarc-settings"] }];

@DmarcApi()
@Controller({ path: "dmarc", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class DmarcController {
  constructor(
    private readonly dmarc: DmarcService,
    private readonly activity: ActivityLogService
  ) {}

  @Get("overview")
  @RequireGlobalPermissions(VIEW)
  @DmarcOverviewDocs()
  overview() {
    return this.dmarc.overview();
  }

  @Get("incoming")
  @RequireGlobalPermissions(VIEW)
  @DmarcIncomingDocs()
  incoming(
    @Query(new ZodValidationPipe(dmarcIncomingQuerySchema))
    query: DmarcIncomingQuery
  ) {
    return this.dmarc.listIncoming(query);
  }

  @Get("incoming/:id")
  @RequireGlobalPermissions(VIEW)
  @DmarcIncomingReportDocs()
  incomingReport(@Param("id", ParseIntPipe) id: number) {
    return this.dmarc.incomingReport(id);
  }

  @Get("incoming/:id/xml")
  @RequireGlobalPermissions(VIEW)
  @DmarcIncomingXmlDocs()
  incomingXml(@Param("id", ParseIntPipe) id: number) {
    return this.dmarc.incomingXml(id);
  }

  @Get("outgoing")
  @RequireGlobalPermissions(VIEW)
  @DmarcOutgoingDocs()
  outgoing(
    @Query(new ZodValidationPipe(dmarcOutgoingQuerySchema))
    query: DmarcOutgoingQuery
  ) {
    return this.dmarc.listOutgoing(query);
  }

  @Get("outgoing/:id/xml")
  @RequireGlobalPermissions(VIEW)
  @DmarcOutgoingXmlDocs()
  outgoingXml(@Param("id", ParseIntPipe) id: number) {
    return this.dmarc.outgoingXml(id);
  }

  @Post("outgoing/run")
  @HttpCode(200)
  @RequireGlobalPermissions(SEND)
  @DmarcRunDocs()
  async run(@Body(new ZodValidationPipe(dmarcRunSchema)) body: DmarcRunDto) {
    const summary = await this.dmarc.runReports(body.day);
    await this.activity.record({
      action: "dmarc.reports-sent",
      entity: { type: "service", label: "dmarc" },
      details: { ...summary },
    });
    return summary;
  }

  @Post("outgoing/:id/retry")
  @HttpCode(200)
  @RequireGlobalPermissions(SEND)
  @DmarcRetryDocs()
  async retry(@Param("id", ParseIntPipe) id: number) {
    const row = await this.dmarc.retryOutgoing(id);
    await this.activity.record({
      action: "dmarc.report-retried",
      entity: { type: "dmarc-report", id, label: row.recipient },
      details: { status: row.status, reportId: row.reportId },
    });
    return row;
  }

  @Get("inbox")
  @RequireGlobalPermissions(VIEW)
  @DmarcInboxDocs()
  inbox(@Query(new ZodValidationPipe(dmarcInboxQuerySchema)) query: DmarcInboxQuery) {
    return this.dmarc.listInbox(query);
  }

  @Post("inbox/scan")
  @HttpCode(200)
  @RequireGlobalPermissions(IMPORT)
  @DmarcScanDocs()
  async scan() {
    const summary = await this.dmarc.scanInbox();
    await this.activity.record({
      action: "dmarc.inbox-scanned",
      entity: { type: "service", label: "dmarc" },
      details: { ...summary },
    });
    return summary;
  }

  @Get("settings")
  @RequireGlobalPermissions(MANAGE)
  @DmarcSettingsDocs()
  settings() {
    return this.dmarc.getSettings();
  }

  @Put("settings")
  @RequireGlobalPermissions(MANAGE)
  @DmarcUpdateSettingsDocs()
  async updateSettings(@Body(new ZodValidationPipe(dmarcSettingsSchema)) body: DmarcSettingsDto) {
    const settings = await this.dmarc.updateSettings(body);
    await this.activity.record({
      action: "dmarc.settings-updated",
      entity: { type: "service", label: "dmarc" },
      details: { ...settings },
    });
    return settings;
  }

  @Get("mailboxes")
  @RequireGlobalPermissions(MANAGE)
  @DmarcMailboxesDocs()
  mailboxes() {
    return this.dmarc.mailboxes();
  }
}
