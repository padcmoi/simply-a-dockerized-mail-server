import { Module } from "@nestjs/common";
import { HealthcheckModule } from "../../core/healthcheck/healthcheck.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [HealthcheckModule],
  controllers: [HealthController],
})
export class HealthModule {}
