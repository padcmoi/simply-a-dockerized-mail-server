import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GeoipCache } from "../entities/geoip-cache.entity";
import { SettingsModule } from "../settings/settings.module";
import { GeoipService } from "./geoip.service";

@Module({
  imports: [TypeOrmModule.forFeature([GeoipCache]), SettingsModule],
  providers: [GeoipService],
  exports: [GeoipService],
})
export class GeoipModule {}
