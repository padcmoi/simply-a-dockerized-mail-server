import { describe, it, expect } from "vitest";
import { Global, Module } from "@nestjs/common";
import { getDataSourceToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import { NotificationsApiModule } from "../../src/api/notifications/notifications.module";
import { NotificationsController } from "../../src/api/notifications/notifications.controller";
import { NotificationsService } from "../../src/core/notifications/notifications.service";

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

describe("NotificationsApiModule (DI wiring / boot)", () => {
  it("resolves the notifications dependency graph, mailer included", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeDataSourceModule, NotificationsApiModule],
    }).compile();

    expect(moduleRef.get(NotificationsController, { strict: false })).toBeInstanceOf(NotificationsController);
    expect(moduleRef.get(NotificationsService, { strict: false })).toBeInstanceOf(NotificationsService);
    await moduleRef.close();
  });
});
