import { Module } from "@nestjs/common";
import { CustomPermissionGuardModule } from "../../core/custom-permission-guard/custom-permission-guard.module";
import { MailLogsController } from "./mail-logs.controller";
import { MailLogsService } from "./mail-logs.service";

@Module({
  imports: [CustomPermissionGuardModule],
  controllers: [MailLogsController],
  providers: [MailLogsService],
  exports: [MailLogsService],
})
export class MailLogsApiModule {}
