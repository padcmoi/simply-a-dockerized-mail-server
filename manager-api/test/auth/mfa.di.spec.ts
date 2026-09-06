import { describe, it, expect } from "vitest";
import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { getDataSourceToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import { MfaModule } from "../../src/core/auth/mfa/mfa.module";
import { MfaController } from "../../src/core/auth/mfa/mfa.controller";
import { MfaService } from "../../src/core/auth/mfa/mfa.service";
import { MfaLoginService } from "../../src/core/auth/mfa/mfa-login.service";
import { MfaChallengeStore } from "../../src/core/auth/mfa/mfa-challenge.store";
import { LoginRiskService } from "../../src/core/auth/mfa/login-risk.service";
import { SecurityQuestionGuard } from "../../src/core/auth/mfa/security-question.guard";

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

// A module whose imports are one short compiles under tsc and passes every
// mocked spec, then fails at boot. Only the real graph catches it, and this one
// reaches the mailer and the settings through two of its own services.
describe("MfaModule (DI wiring / boot)", () => {
  it("resolves the whole MFA graph", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), FakeDataSourceModule, MfaModule],
    }).compile();

    expect(moduleRef.get(MfaController, { strict: false })).toBeInstanceOf(MfaController);
    expect(moduleRef.get(MfaService, { strict: false })).toBeInstanceOf(MfaService);
    expect(moduleRef.get(MfaLoginService, { strict: false })).toBeInstanceOf(MfaLoginService);
    expect(moduleRef.get(MfaChallengeStore, { strict: false })).toBeInstanceOf(MfaChallengeStore);
    expect(moduleRef.get(LoginRiskService, { strict: false })).toBeInstanceOf(LoginRiskService);
  });

  // The guard is declared on the application, not in this module, so it is
  // instantiated with what the module exports: the day MfaService stops being
  // exported, this is what says so.
  it("gives the security-question guard the service it reads", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), FakeDataSourceModule, MfaModule],
      providers: [SecurityQuestionGuard],
    }).compile();

    expect(moduleRef.get(SecurityQuestionGuard, { strict: false })).toBeInstanceOf(SecurityQuestionGuard);
  });
});
