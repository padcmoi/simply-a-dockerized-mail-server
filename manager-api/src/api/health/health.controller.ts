import { Controller, Get } from "@nestjs/common";
import { HealthApi, HealthStatusDocs } from "./health.openapi";

@HealthApi()
@Controller("health")
export class HealthController {
  @Get()
  @HealthStatusDocs()
  status() {
    return { status: "ok", service: "mail-manager-api", timestamp: new Date().toISOString() };
  }
}
