import { describe, it, expect } from "vitest";
import { Global, Module } from "@nestjs/common";
import { getDataSourceToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import { AccountThemeController } from "../../src/api/theme/account-theme.controller";
import { AppThemeController } from "../../src/api/theme/app-theme.controller";
import { ThemeApiModule } from "../../src/api/theme/theme.module";
import { ThemeService } from "../../src/core/theme/theme.service";

// A DataSource stand-in so TypeOrmModule.forFeature resolves its repositories
// without a real database. This is the DI boot test: it compiles the actual
// module graph, so a forgotten import fails here rather than at runtime, which
// neither tsc nor the mocked e2e would catch.
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

describe("ThemeApiModule (DI wiring / boot)", () => {
  it("resolves both controllers and the theme service", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeDataSourceModule, ThemeApiModule],
    }).compile();

    expect(moduleRef.get(AppThemeController, { strict: false })).toBeInstanceOf(AppThemeController);
    expect(moduleRef.get(AccountThemeController, { strict: false })).toBeInstanceOf(AccountThemeController);
    expect(moduleRef.get(ThemeService, { strict: false })).toBeInstanceOf(ThemeService);
    await moduleRef.close();
  });
});
