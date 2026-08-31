import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccountTheme } from "../entities/account-theme.entity";
import { AppTheme } from "../entities/app-theme.entity";
import { ThemeService } from "./theme.service";

@Module({
  imports: [TypeOrmModule.forFeature([AppTheme, AccountTheme])],
  providers: [ThemeService],
  exports: [ThemeService],
})
export class ThemeModule {}
