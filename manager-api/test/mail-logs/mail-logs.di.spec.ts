import { describe, it, expect } from "vitest";
import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { getDataSourceToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import { MailLogsApiModule } from "../../src/api/mail-logs/mail-logs.module";
import { MailLogsController } from "../../src/api/mail-logs/mail-logs.controller";
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

describe("MailLogsApiModule (DI wiring / boot)", () => {
  it("resolves the mail logs graph, guard included", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), FakeDataSourceModule, MailLogsApiModule],
    }).compile();

    expect(moduleRef.get(MailLogsController, { strict: false })).toBeInstanceOf(MailLogsController);
    expect(moduleRef.get(GlobalPermissionGuard, { strict: false })).toBeInstanceOf(GlobalPermissionGuard);
    await moduleRef.close();
  });
});
