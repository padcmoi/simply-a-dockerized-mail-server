import { Controller, Get, Param, StreamableFile } from "@nestjs/common";
import { Public } from "../../core/auth/auth.decorator";
import { BackupService } from "../../core/backups/backup.service";
import { BackupDownloadDocs, BackupsApi } from "./backups.openapi";

@BackupsApi()
@Controller({ path: "backups/download", version: "1" })
export class BackupDownloadController {
  constructor(private readonly backups: BackupService) {}

  @Public()
  @Get(":token")
  @BackupDownloadDocs()
  async download(@Param("token") token: string) {
    const file = await this.backups.openDownload(token);
    return new StreamableFile(file.stream, {
      type: "application/gzip",
      disposition: `attachment; filename="${file.name}"`,
      length: file.size,
    });
  }
}
