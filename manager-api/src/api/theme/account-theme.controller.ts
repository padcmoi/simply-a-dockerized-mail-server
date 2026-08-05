import { Body, Controller, Get, Put, Req } from "@nestjs/common";
import type { Request } from "express";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { ThemeService } from "../../core/theme/theme.service";
import { GetAccountThemeDocs, ThemeApi, UpdateAccountThemeDocs } from "./theme.openapi";
import { UpdateThemeDto, updateThemeSchema } from "./theme.validation";

type AuthedRequest = Request & {
  user: { id: string; email: string; isRoot: boolean };
};

// No permission guard, like the rest of `my-space`: the account in the token is
// the only account these routes can reach, so there is nothing left to authorize.
@ThemeApi()
@Controller({ path: "my-space/theme", version: "1" })
export class AccountThemeController {
  constructor(private readonly theme: ThemeService) {}

  @Get()
  @GetAccountThemeDocs()
  get(@Req() req: AuthedRequest) {
    return this.theme.readAccount(req.user.id);
  }

  @Put()
  @UpdateAccountThemeDocs()
  update(@Req() req: AuthedRequest, @Body(new ZodValidationPipe(updateThemeSchema)) body: UpdateThemeDto) {
    return this.theme.saveAccount(req.user.id, body);
  }
}
