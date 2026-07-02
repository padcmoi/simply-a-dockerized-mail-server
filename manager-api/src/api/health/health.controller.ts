import { Controller, Get } from "@nestjs/common";
import { Public } from "../../core/auth/auth.decorator";
import { HealthcheckService } from "../../core/healthcheck/healthcheck.service";
import { HealthApi, HealthStatusDocs } from "./health.openapi";

@Public()
@HealthApi()
@Controller({ path: "health", version: "1" })
export class HealthController {
  constructor(private readonly healthcheck: HealthcheckService) {}

  @Get()
  @HealthStatusDocs()
  async status() {
    return { healthcheck: await this.healthcheck.snapshot() };
  }
}
