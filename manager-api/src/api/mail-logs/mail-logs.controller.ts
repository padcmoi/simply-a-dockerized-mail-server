import { BadRequestException, Controller, Get, NotFoundException, Param, Query, StreamableFile, UseGuards } from "@nestjs/common";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../core/custom-permission-guard/require-permissions.decorator";
import { DownloadMailLogDocs, MailLogsApi, ReadMailLogDocs } from "./mail-logs.openapi";
import { MailLogsService } from "./mail-logs.service";
import { MAIL_LOG_SERVICES, mailLogQuerySchema, type MailLogQuery, type MailLogService } from "./mail-logs.validation";

@MailLogsApi()
@Controller({ path: "mail-logs", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class MailLogsController {
  constructor(private readonly logs: MailLogsService) {}

  @Get(":service/download")
  @RequireGlobalPermissions([{ resource: "supervision", actions: ["access", "view-mail-logs"] }])
  @DownloadMailLogDocs()
  async download(@Param("service") service: string) {
    if (!(MAIL_LOG_SERVICES as readonly string[]).includes(service)) throw new BadRequestException("Unknown service");
    const file = await this.logs.file(service as MailLogService);
    if (!file) throw new NotFoundException("No log yet");
    return new StreamableFile(file.stream, {
      type: "text/plain; charset=utf-8",
      disposition: `attachment; filename="${service}.log"`,
      length: file.size,
    });
  }

  @Get(":service")
  @RequireGlobalPermissions([{ resource: "supervision", actions: ["access", "view-mail-logs"] }])
  @ReadMailLogDocs()
  read(@Param("service") service: string, @Query(new ZodValidationPipe(mailLogQuerySchema)) query: MailLogQuery) {
    if (!(MAIL_LOG_SERVICES as readonly string[]).includes(service)) throw new BadRequestException("Unknown service");
    return this.logs.tail(service as MailLogService, query);
  }
}
