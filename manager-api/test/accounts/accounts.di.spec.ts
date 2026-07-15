import { describe, it, expect } from "vitest";
import { Global, Module } from "@nestjs/common";
import { getDataSourceToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import { AccountsModule } from "../../src/api/accounts/accounts.module";
import { GlobalPermissionGuard } from "../../src/core/custom-permission-guard/global-permission.guard";
import { GeocodingService } from "../../src/core/geocoding/geocoding.service";
import { MailerService } from "../../src/core/mailer/mailer.service";
import { JwtAuthService } from "../../src/core/auth/jwt/jwt.service";
import { JwtStrategy } from "../../src/core/auth/jwt/jwt.strategy";

// A fake default DataSource so every TypeOrmModule.forFeature repository in the
// real accounts graph resolves without a database. Global so the nested
// sub-modules (crud / sessions / invitations and their CustomPermissionGuardModule)
// all see it.
@Global()
@Module({
  providers: [
    {
      provide: getDataSourceToken(),
      // Shaped for @nestjs/typeorm's forFeature factory (reads entityMetadatas +
      // options.type before calling getRepository).
      useValue: { entityMetadatas: [], options: { type: "mysql" }, getRepository: () => ({}) },
    },
  ],
  exports: [getDataSourceToken()],
})
class FakeDataSourceModule {}

// Compiles the REAL AccountsModule dependency graph -- guards and the
// CustomPermissionGuardModule wiring included. This is what catches a controller
// guarded by GlobalPermissionGuard whose module forgot to import
// CustomPermissionGuardModule: a boot-time DI failure that both `tsc` (types
// only) and the mocked e2e harness (it injects the guard + service directly)
// miss. Only the DB and the network-touching leaf services are stubbed; the
// module import structure is exercised for real.
describe("AccountsModule (DI wiring / boot)", () => {
  it("resolves the full accounts dependency graph, guards included", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeDataSourceModule, AccountsModule],
    })
      .overrideProvider(GeocodingService)
      .useValue({})
      .overrideProvider(MailerService)
      .useValue({})
      .overrideProvider(JwtAuthService)
      .useValue({})
      .overrideProvider(JwtStrategy)
      .useValue({})
      .compile();

    // The guard instantiating at all proves CustomPermissionGuardService was in
    // scope for every accounts controller's module.
    expect(moduleRef.get(GlobalPermissionGuard, { strict: false })).toBeInstanceOf(GlobalPermissionGuard);
    await moduleRef.close();
  });
});
