import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomPermissionGuardModule } from "../custom-permission-guard/custom-permission-guard.module";
import { Account } from "../entities/account.entity";
import { MetricsHistory } from "../entities/metrics-history.entity";
import { Fail2banHistory } from "../entities/fail2ban-history.entity";
import { Fail2banCoreModule } from "../fail2ban/fail2ban.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PostfixCoreModule } from "../postfix/postfix.module";
import { RspamdCoreModule } from "../rspamd/rspamd.module";
import { SettingsModule } from "../settings/settings.module";
import { MachineAlertsService } from "./machine-alerts.service";
import { ServiceMetricsService } from "./service-metrics.service";
import { SupervisionHistoryService } from "./supervision-history.service";
import { SupervisionRecorderService } from "./supervision-recorder.service";
import { SystemMetricsService } from "./system-metrics.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([MetricsHistory, Fail2banHistory, Account]),
    SettingsModule,
    NotificationsModule,
    CustomPermissionGuardModule,
    RspamdCoreModule,
    PostfixCoreModule,
    Fail2banCoreModule,
  ],
  providers: [
    SystemMetricsService,
    ServiceMetricsService,
    SupervisionRecorderService,
    SupervisionHistoryService,
    MachineAlertsService,
  ],
  exports: [
    SystemMetricsService,
    ServiceMetricsService,
    SupervisionRecorderService,
    SupervisionHistoryService,
    MachineAlertsService,
  ],
})
export class SupervisionModule {}
