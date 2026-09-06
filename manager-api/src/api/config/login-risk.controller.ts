import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { RootGuard } from "../../core/auth/root.guard";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { AppSettingsService } from "../../core/settings/app-settings.service";
import { GetLoginRiskDocs, LoginRiskApi, UpdateLoginRiskDocs } from "./login-risk.openapi";
import { UpdateLoginRiskDto, updateLoginRiskSchema } from "./login-risk.validation";

@LoginRiskApi()
@UseGuards(RootGuard)
@Controller({ path: "config/login-risk", version: "1" })
export class LoginRiskController {
  constructor(private readonly settings: AppSettingsService) {}

  @Get()
  @GetLoginRiskDocs()
  get() {
    const view = this.settings.get();
    return { loginRadiusKm: view.loginRadiusKm, loginChallengeOrder: view.loginChallengeOrder };
  }

  @Put()
  @UpdateLoginRiskDocs()
  async update(@Body(new ZodValidationPipe(updateLoginRiskSchema)) body: UpdateLoginRiskDto) {
    const view = await this.settings.update(body);
    return { loginRadiusKm: view.loginRadiusKm, loginChallengeOrder: view.loginChallengeOrder };
  }
}
