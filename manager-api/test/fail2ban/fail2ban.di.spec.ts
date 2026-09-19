import { describe, it, expect } from "vitest";
import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { getDataSourceToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import { Fail2banApiModule } from "../../src/api/fail2ban/fail2ban.module";
import { Fail2banController } from "../../src/api/fail2ban/fail2ban.controller";
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

describe("Fail2banApiModule (DI wiring / boot)", () => {
  it("resolves the fail2ban graph, guard included", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), FakeDataSourceModule, Fail2banApiModule],
    }).compile();

    expect(moduleRef.get(Fail2banController, { strict: false })).toBeInstanceOf(Fail2banController);
    expect(moduleRef.get(GlobalPermissionGuard, { strict: false })).toBeInstanceOf(GlobalPermissionGuard);
    await moduleRef.close();
  });
});
