import { describe, it, expect } from "vitest";
import { Global, Module } from "@nestjs/common";
import { getDataSourceToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import { ApiTokenModule } from "../../src/core/auth/api-token/api-token.module";
import { ApiTokenAccessMiddleware } from "../../src/core/auth/api-token/api-token-access.middleware";
import { ApiTokenAccessService } from "../../src/core/auth/api-token/api-token-access.service";
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

describe("ApiTokenModule (DI wiring / boot)", () => {
  it("resolves the api-token dependency graph, trail and guard included", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeDataSourceModule, ApiTokenModule],
    }).compile();

    expect(moduleRef.get(GlobalPermissionGuard, { strict: false })).toBeInstanceOf(GlobalPermissionGuard);
    expect(moduleRef.get(ApiTokenAccessService, { strict: false })).toBeInstanceOf(ApiTokenAccessService);
    expect(moduleRef.get(ApiTokenAccessMiddleware, { strict: false })).toBeInstanceOf(ApiTokenAccessMiddleware);
    await moduleRef.close();
  });
});
