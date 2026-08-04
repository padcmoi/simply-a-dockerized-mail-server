import { BadRequestException, Controller, Get, Param, UseGuards } from "@nestjs/common";
import { GlobalPermissionGuard } from "../../core/custom-permission-guard/global-permission.guard";
import { RequireGlobalPermissions } from "../../core/custom-permission-guard/require-permissions.decorator";
import { METRIC_RANGES, SupervisionHistoryService, type MetricRange } from "../../core/supervision/supervision-history.service";
import { SupervisionRecorderService } from "../../core/supervision/supervision-recorder.service";
import { GetHistoryDocs, GetLiveDocs, SupervisionApi } from "./supervision.openapi";

@SupervisionApi()
@Controller({ path: "supervision", version: "1" })
@UseGuards(GlobalPermissionGuard)
export class SupervisionController {
  constructor(
    private readonly recorder: SupervisionRecorderService,
    private readonly history: SupervisionHistoryService
  ) {}

  // The window the page starts on, so a tab that has just opened draws the
  // minute the loop has already been keeping instead of a line crawling in from
  // the left. Everything after it arrives on the websocket topic.
  @RequireGlobalPermissions([{ resource: "supervision", actions: ["access", "view-machine-metrics"] }])
  @GetLiveDocs()
  @Get("live")
  live() {
    return { snapshot: this.recorder.latest(), points: this.recorder.recent() };
  }

  @RequireGlobalPermissions([{ resource: "supervision", actions: ["access", "view-metrics-history"] }])
  @GetHistoryDocs()
  @Get("history/:range")
  read(@Param("range") range: string) {
    if (!Object.hasOwn(METRIC_RANGES, range)) throw new BadRequestException("Unknown range");
    return this.history.read(range as MetricRange);
  }
}
