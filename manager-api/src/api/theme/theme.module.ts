import { Module } from "@nestjs/common";
import { ThemeModule } from "../../core/theme/theme.module";
import { AccountThemeController } from "./account-theme.controller";
import { AppThemeController } from "./app-theme.controller";

@Module({
  imports: [ThemeModule],
  controllers: [AppThemeController, AccountThemeController],
})
export class ThemeApiModule {}
