import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { Public } from "../../core/auth/auth.decorator";
import { RootGuard } from "../../core/auth/root.guard";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { THEME_ALIASES, THEME_SURFACES } from "../../core/theme/theme.catalog";
import { ThemeService } from "../../core/theme/theme.service";
import { GetAppThemeDocs, ThemeApi, UpdateAppThemeDocs } from "./theme.openapi";
import { UpdateThemeDto, updateThemeSchema } from "./theme.validation";

@ThemeApi()
@Controller({ path: "config/theme", version: "1" })
export class AppThemeController {
  constructor(private readonly theme: ThemeService) {}

  // Read without a token, on purpose and alone in this namespace: the login
  // screen wears this theme, and the interface's own server fetches it before it
  // has anyone to be authenticated as. What it exposes is a list of colours.
  @Public()
  @Get()
  @GetAppThemeDocs()
  async get() {
    return { tokens: { aliases: THEME_ALIASES, surfaces: THEME_SURFACES }, ...(await this.theme.readApp()) };
  }

  // Writing is another matter entirely: what everyone sees is a server decision,
  // like the rest of `/config`.
  @UseGuards(RootGuard)
  @Put()
  @UpdateAppThemeDocs()
  update(@Body(new ZodValidationPipe(updateThemeSchema)) body: UpdateThemeDto) {
    return this.theme.saveApp(body);
  }
}
