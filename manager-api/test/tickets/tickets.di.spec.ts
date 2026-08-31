import { describe, it, expect } from "vitest";
import { Global, Module } from "@nestjs/common";
import { getDataSourceToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import { TicketsModule } from "../../src/api/tickets/tickets.module";
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

describe("TicketsModule (DI wiring / boot)", () => {
  it("resolves the tickets dependency graph, guard included", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeDataSourceModule, TicketsModule],
    }).compile();

    expect(moduleRef.get(GlobalPermissionGuard, { strict: false })).toBeInstanceOf(GlobalPermissionGuard);
    await moduleRef.close();
  });
});
