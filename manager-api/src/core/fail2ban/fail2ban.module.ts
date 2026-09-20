import { Module } from "@nestjs/common";
import { Fail2banDbService } from "./fail2ban-db.service";
import { Fail2banService } from "./fail2ban.service";

@Module({
  providers: [Fail2banDbService, Fail2banService],
  exports: [Fail2banService],
})
export class Fail2banCoreModule {}
