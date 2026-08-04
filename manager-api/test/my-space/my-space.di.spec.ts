import { describe, it, expect } from "vitest";
import { Global, Module } from "@nestjs/common";
import { getDataSourceToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import { MySpaceModule } from "../../src/api/my-space/my-space.module";
import { MySpaceService } from "../../src/api/my-space/my-space.service";
import { RecipientsService } from "../../src/api/domains/recipients/recipients.service";
import { AliasesService } from "../../src/api/domains/aliases/aliases.service";
import { MailStorageService } from "../../src/core/mail-storage/mail-storage.service";

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

// Compiles the REAL MySpaceModule graph: it reuses RecipientsService and
// AliasesService by importing their modules, so this catches a missing export
// (AliasesService) or a broken import that tsc and the mocked e2e both miss.
describe("MySpaceModule (DI wiring / boot)", () => {
  it("resolves the personal-space graph against the reused recipient and alias services", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeDataSourceModule, MySpaceModule],
    })
      .overrideProvider(MailStorageService)
      .useValue({})
      .compile();

    expect(moduleRef.get(MySpaceService, { strict: false })).toBeInstanceOf(MySpaceService);
    expect(moduleRef.get(RecipientsService, { strict: false })).toBeInstanceOf(RecipientsService);
    expect(moduleRef.get(AliasesService, { strict: false })).toBeInstanceOf(AliasesService);
    await moduleRef.close();
  });
});
