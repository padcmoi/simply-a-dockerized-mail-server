import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomPermissionGuardModule } from "../custom-permission-guard/custom-permission-guard.module";
import { Account } from "../entities/account.entity";
import { NotificationsModule } from "../notifications/notifications.module";
import { ClamavAlertsService } from "./clamav-alerts.service";
import { ClamavDatabasesService } from "./clamav-databases.service";
import { ClamavPublishedService } from "./clamav-published.service";
import { ClamavService } from "./clamav.service";
import { ClamavUpdaterService } from "./clamav-updater.service";
import { ClamdClient } from "./clamd.client";

@Module({
  imports: [TypeOrmModule.forFeature([Account]), NotificationsModule, CustomPermissionGuardModule],
  providers: [
    ClamdClient,
    ClamavDatabasesService,
    ClamavPublishedService,
    ClamavUpdaterService,
    ClamavService,
    ClamavAlertsService,
  ],
  exports: [ClamavService, ClamavAlertsService],
})
export class ClamavCoreModule {}
