import { describe, it, expect } from "vitest";
import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { getDataSourceToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import { ClamavApiModule } from "../../src/api/clamav/clamav.module";
import { ClamavController } from "../../src/api/clamav/clamav.controller";
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

describe("ClamavApiModule (DI wiring / boot)", () => {
  it("resolves the clamav graph, guard included", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), FakeDataSourceModule, ClamavApiModule],
    }).compile();

    expect(moduleRef.get(ClamavController, { strict: false })).toBeInstanceOf(ClamavController);
    expect(moduleRef.get(GlobalPermissionGuard, { strict: false })).toBeInstanceOf(GlobalPermissionGuard);
    await moduleRef.close();
  });
});
