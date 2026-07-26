import { describe, it, expect } from "vitest";
import { Global, Module } from "@nestjs/common";
import { getDataSourceToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import { ConfigApiModule } from "../../src/api/config/config.module";
import { MailConfigController } from "../../src/api/config/mail-config.controller";
import { MailSettingsService } from "../../src/core/mailer/mail-settings.service";
import { MailerService } from "../../src/core/mailer/mailer.service";

// A DataSource stand-in so TypeOrmModule.forFeature (MailSetting, inside
// MailerModule) resolves its repository without a real database. This is the DI
// boot test: it compiles the actual ConfigApiModule graph, so a forgotten
// MailerModule import (which tsc and the mocked e2e both miss) fails here.
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

describe("ConfigApiModule (DI wiring / boot)", () => {
  it("resolves the /config graph: controller, mailer and settings service", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeDataSourceModule, ConfigApiModule],
    }).compile();

    expect(moduleRef.get(MailConfigController, { strict: false })).toBeInstanceOf(MailConfigController);
    expect(moduleRef.get(MailSettingsService, { strict: false })).toBeInstanceOf(MailSettingsService);
    expect(moduleRef.get(MailerService, { strict: false })).toBeInstanceOf(MailerService);
    await moduleRef.close();
  });
});
