import { describe, it, expect } from "vitest";
import { Global, Module } from "@nestjs/common";
import { getDataSourceToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import { SupervisionApiModule } from "../../src/api/supervision/supervision.module";
import { SupervisionController } from "../../src/api/supervision/supervision.controller";
import { SupervisionHistoryService } from "../../src/core/supervision/supervision-history.service";
import { SupervisionRecorderService } from "../../src/core/supervision/supervision-recorder.service";
import { MachineAlertsService } from "../../src/core/supervision/machine-alerts.service";
import { GlobalPermissionGuard } from "../../src/core/custom-permission-guard/global-permission.guard";

@Global()
@Module({
  providers: [
    {
      provide: getDataSourceToken(),
      useValue: { entityMetadatas: [], options: { type: "mysql" }, getRepository: () => ({}) },
    },
  ],
  exports: [getDataSourceToken()],
})
class FakeDataSourceModule {}

// The guarded controller needs CustomPermissionGuardModule in its own module,
// which tsc and the mocked e2e harness both miss: only compiling the real graph
// catches it.
describe("SupervisionApiModule (DI wiring / boot)", () => {
  it("resolves the supervision graph, guard included", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeDataSourceModule, SupervisionApiModule],
    }).compile();

    expect(moduleRef.get(SupervisionController, { strict: false })).toBeInstanceOf(SupervisionController);
    expect(moduleRef.get(SupervisionRecorderService, { strict: false })).toBeInstanceOf(SupervisionRecorderService);
    expect(moduleRef.get(SupervisionHistoryService, { strict: false })).toBeInstanceOf(SupervisionHistoryService);
    expect(moduleRef.get(GlobalPermissionGuard, { strict: false })).toBeInstanceOf(GlobalPermissionGuard);
    // The sampling loop now notifies, so it drags the notifications and the
    // permission guard into its own graph: a missing import here is a boot that
    // fails in production and nowhere else.
    expect(moduleRef.get(MachineAlertsService, { strict: false })).toBeInstanceOf(MachineAlertsService);
    await moduleRef.close();
  });
});
