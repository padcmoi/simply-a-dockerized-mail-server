import { BadRequestException, Controller, Get, NotFoundException, Param, Query, StreamableFile, UseGuards } from "@nestjs/common";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../core/custom-permission-guard/require-permissions.decorator";
import { DownloadMailLogDocs, MailLogsApi, ReadMailLogDocs } from "./mail-logs.openapi";
import { MailLogsService } from "./mail-logs.service";
import {
  MAIL_LOG_SERVICES,
  mailLogDownloadSchema,
  mailLogQuerySchema,
  type MailLogDownloadQuery,
  type MailLogQuery,
  type MailLogService,
} from "./mail-logs.validation";

@MailLogsApi()
@Controller({ path: "mail-logs", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class MailLogsController {
  constructor(private readonly logs: MailLogsService) {}

  @Get(":service/download")
  @RequireGlobalPermissions([{ resource: "supervision", actions: ["access", "view-mail-logs"] }])
  @DownloadMailLogDocs()
  async download(
    @Param("service") service: string,
    @Query(new ZodValidationPipe(mailLogDownloadSchema)) { archive }: MailLogDownloadQuery
  ) {
    if (!(MAIL_LOG_SERVICES as readonly string[]).includes(service)) throw new BadRequestException("Unknown service");
    if (archive !== undefined && !archive.startsWith(`${service}.log.`)) {
      throw new BadRequestException("Archive of another service");
    }
    const file =
      archive === undefined
        ? await this.logs.file(service as MailLogService)
        : await this.logs.file(service as MailLogService, archive);
    if (!file) throw new NotFoundException(archive === undefined ? "No log yet" : "No such archive");
    const filename = archive === undefined ? `${service}.log` : `${archive.replace(/\.gz$/, "").replace(".log.", "-")}.log`;
    return new StreamableFile(file.stream, {
      type: "text/plain; charset=utf-8",
      disposition: `attachment; filename="${filename}"`,
      ...(file.size === null ? {} : { length: file.size }),
    });
  }

  @Get(":service")
  @RequireGlobalPermissions([{ resource: "supervision", actions: ["access", "view-mail-logs"] }])
  @ReadMailLogDocs()
  async read(@Param("service") service: string, @Query(new ZodValidationPipe(mailLogQuerySchema)) query: MailLogQuery) {
    if (!(MAIL_LOG_SERVICES as readonly string[]).includes(service)) throw new BadRequestException("Unknown service");
    const [window, archives] = await Promise.all([
      this.logs.tail(service as MailLogService, query),
      this.logs.archives(service as MailLogService),
    ]);
    return { ...window, archives };
  }
}
