import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ActivityLogService } from "../../core/activity/activity-log.service";
import { RootGuard } from "../../core/auth/root.guard";
import { BackupConfigService } from "../../core/backups/backup-config.service";
import { BackupOffsiteService } from "../../core/backups/backup-offsite.service";
import { BackupRetrievalService } from "../../core/backups/backup-retrieval.service";
import { BackupService } from "../../core/backups/backup.service";
import { BACKUP_ARCHIVE_PATTERN, backupConfigSchema, type BackupConfigDto } from "../../core/backups/backup.validation";
import { paginationQuerySchema, type PaginationQuery } from "../../core/common/pagination.validation";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import {
  BackupDownloadLinkDocs,
  BackupFilesDocs,
  BackupOverviewDocs,
  BackupRunLogDocs,
  BackupRunsDocs,
  BackupsApi,
  RetrieveBackupFileDocs,
  UpdateBackupConfigDocs,
} from "./backups.openapi";

@BackupsApi()
@Controller({ path: "backups", version: "1" })
@UseGuards(RootGuard)
export class BackupsController {
  constructor(
    private readonly backups: BackupService,
    private readonly config: BackupConfigService,
    private readonly retrieval: BackupRetrievalService,
    private readonly offsite: BackupOffsiteService,
    private readonly activity: ActivityLogService
  ) {}

  @Get()
  @BackupOverviewDocs()
  async overview() {
    const [state, lastRun, projectReadable, retrieval, offsite] = await Promise.all([
      this.config.state(),
      this.backups.lastRun(),
      this.backups.projectMounted(),
      this.retrieval.state(),
      this.offsite.state(),
    ]);
    return { ...state, lastRun, projectReadable, retrieval, offsite };
  }

  @Get("runs")
  @BackupRunsDocs()
  runs(@Query(new ZodValidationPipe(paginationQuerySchema)) query: PaginationQuery) {
    return this.backups.listRuns(query);
  }

  @Get("runs/:id/log")
  @BackupRunLogDocs()
  runLog(@Param("id", ParseIntPipe) id: number) {
    return this.backups.runLog(id);
  }

  @Get("files")
  @BackupFilesDocs()
  files() {
    return this.backups.listFiles();
  }

  @Post("files/:name/download-link")
  @BackupDownloadLinkDocs()
  async downloadLink(@Param("name") name: string) {
    if (!BACKUP_ARCHIVE_PATTERN.test(name)) throw new NotFoundException("No such archive");
    const link = await this.backups.downloadLink(name);
    await this.activity.record({ action: "backup.download-requested", entity: { type: "backup-file", id: name, label: name } });
    return link;
  }

  @Post("files/:name/retrieve")
  @RetrieveBackupFileDocs()
  async retrieve(@Param("name") name: string) {
    if (!BACKUP_ARCHIVE_PATTERN.test(name)) throw new NotFoundException("No such archive");
    const { from } = await this.backups.retrievalSource(name);
    const state = await this.retrieval.request(name, from);
    await this.activity.record({
      action: "backup.retrieval-requested",
      entity: { type: "backup-file", id: name, label: name },
      details: { from },
    });
    return state;
  }

  @Put("config")
  @UpdateBackupConfigDocs()
  async updateConfig(@Body(new ZodValidationPipe(backupConfigSchema)) body: BackupConfigDto) {
    const state = await this.config.request(body);
    await this.activity.record({
      action: "backup.config-requested",
      details: { time: body.time, keepDays: body.keepDays, offsite: body.offsite, offsiteDeleteLocal: body.offsiteDeleteLocal },
    });
    return state;
  }
}
