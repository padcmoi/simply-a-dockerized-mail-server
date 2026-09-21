import { describe, it, expect } from "vitest";
import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { getDataSourceToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import { DmarcApiModule } from "../../src/api/dmarc/dmarc.module";
import { DmarcController } from "../../src/api/dmarc/dmarc.controller";
import { GlobalPermissionGuard } from "../../src/core/custom-permission-guard/global-permission.guard";
import { DmarcSchedulerService } from "../../src/core/dmarc/dmarc-scheduler.service";

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

describe("DmarcApiModule (DI wiring / boot)", () => {
  it("resolves the dmarc graph, guard and scheduler included", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), FakeDataSourceModule, DmarcApiModule],
    }).compile();

    expect(moduleRef.get(DmarcController, { strict: false })).toBeInstanceOf(DmarcController);
    expect(moduleRef.get(GlobalPermissionGuard, { strict: false })).toBeInstanceOf(GlobalPermissionGuard);
    expect(moduleRef.get(DmarcSchedulerService, { strict: false })).toBeInstanceOf(DmarcSchedulerService);
    await moduleRef.close();
  });
});
