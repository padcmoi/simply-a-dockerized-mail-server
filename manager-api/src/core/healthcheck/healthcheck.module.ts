import { Module } from "@nestjs/common";
import { HealthcheckService } from "./healthcheck.service";

@Module({
  providers: [HealthcheckService],
  exports: [HealthcheckService],
})
export class HealthcheckModule {}
