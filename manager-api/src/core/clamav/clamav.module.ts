import { Module } from "@nestjs/common";
import { ClamavDatabasesService } from "./clamav-databases.service";
import { ClamavPublishedService } from "./clamav-published.service";
import { ClamavService } from "./clamav.service";
import { ClamavUpdaterService } from "./clamav-updater.service";
import { ClamdClient } from "./clamd.client";

@Module({
  providers: [ClamdClient, ClamavDatabasesService, ClamavPublishedService, ClamavUpdaterService, ClamavService],
  exports: [ClamavService],
})
export class ClamavCoreModule {}
