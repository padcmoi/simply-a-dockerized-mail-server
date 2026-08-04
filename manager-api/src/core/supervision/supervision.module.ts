import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MetricsHistory } from "../entities/metrics-history.entity";
import { SettingsModule } from "../settings/settings.module";
import { SupervisionHistoryService } from "./supervision-history.service";
import { SupervisionRecorderService } from "./supervision-recorder.service";
import { SystemMetricsService } from "./system-metrics.service";

@Module({
  imports: [TypeOrmModule.forFeature([MetricsHistory]), SettingsModule],
  providers: [SystemMetricsService, SupervisionRecorderService, SupervisionHistoryService],
  exports: [SystemMetricsService, SupervisionRecorderService, SupervisionHistoryService],
})
export class SupervisionModule {}
