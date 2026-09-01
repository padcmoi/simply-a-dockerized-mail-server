import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Put, UseGuards } from "@nestjs/common";
import { findProvider } from "../../core/auth/passport/passport-providers";
import { PassportAuthService } from "../../core/auth/passport/passport.service";
import { ProviderRegistryService } from "../../core/auth/passport/provider-registry.service";
import { RootGuard } from "../../core/auth/root.guard";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { AppSettingsService } from "../../core/settings/app-settings.service";
import {
  DeleteProviderCredentialsDocs,
  GetPassportConfigDocs,
  PassportConfigApi,
  UpdatePassportConfigDocs,
  UpsertProviderCredentialsDocs,
} from "./passport-config.openapi";
import {
  UpdatePassportConfigDto,
  UpsertProviderCredentialsDto,
  updatePassportConfigSchema,
  upsertProviderCredentialsSchema,
} from "./passport-config.validation";

@PassportConfigApi()
@UseGuards(RootGuard)
@Controller({ path: "config/passport", version: "1" })
export class PassportConfigController {
  constructor(
    private readonly settings: AppSettingsService,
    private readonly passport: PassportAuthService,
    private readonly registry: ProviderRegistryService
  ) {}

  @Get()
  @GetPassportConfigDocs()
  get() {
    const { passportEnabled, passportAutoProvision } = this.settings.get();
    return {
      passportEnabled,
      passportAutoProvision,
      managerUrlSet: this.passport.managerUrlSet(),
      providers: this.passport.adminProviders(),
    };
  }

  @Put()
  @UpdatePassportConfigDocs()
  async update(@Body(new ZodValidationPipe(updatePassportConfigSchema)) body: UpdatePassportConfigDto) {
    await this.settings.update(body);
    return this.get();
  }

  // Credentials go in, nothing comes back out: the answer is the same shape as
  // GET, where a provider is only ever "configured" or not.
  @Put("providers/:provider")
  @UpsertProviderCredentialsDocs()
  async upsertProvider(
    @Param("provider") provider: string,
    @Body(new ZodValidationPipe(upsertProviderCredentialsSchema)) body: UpsertProviderCredentialsDto
  ) {
    if (!findProvider(provider)) throw new NotFoundException(`Unknown provider ${provider}`);
    try {
      await this.registry.upsert(provider, body);
    } catch (err) {
      // The registry refuses a first configuration with no secret, which is a
      // request problem rather than a server one.
      throw new BadRequestException((err as Error).message);
    }
    return this.get();
  }

  @Delete("providers/:provider")
  @DeleteProviderCredentialsDocs()
  async removeProvider(@Param("provider") provider: string) {
    if (!findProvider(provider)) throw new NotFoundException(`Unknown provider ${provider}`);
    await this.registry.remove(provider);
    return this.get();
  }
}
