import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppSetting } from "../entities/app-setting.entity";
import { VirtualDomain } from "../entities/virtual-domain.entity";
import { PostfixSettingsService } from "./postfix-settings.service";

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting, VirtualDomain])],
  providers: [PostfixSettingsService],
  exports: [PostfixSettingsService],
})
export class PostfixSettingsModule {}
