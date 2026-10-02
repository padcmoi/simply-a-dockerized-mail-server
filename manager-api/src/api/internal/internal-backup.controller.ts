import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Public } from "../../core/auth/auth.decorator";
import { LoopbackGuard } from "../../core/auth/loopback.guard";
import { BackupService } from "../../core/backups/backup.service";
import { backupReportSchema, type BackupReportDto } from "../../core/backups/backup.validation";
import { ZodValidationPipe } from "../../core/common/zod.pipe";

@ApiExcludeController()
@Public()
@UseGuards(LoopbackGuard)
@Controller({ path: "internal/backup", version: "1" })
export class InternalBackupController {
  constructor(private readonly backups: BackupService) {}

  @Post("report")
  @HttpCode(204)
  async report(@Body(new ZodValidationPipe(backupReportSchema)) body: BackupReportDto) {
    await this.backups.ingest(body);
  }
}
