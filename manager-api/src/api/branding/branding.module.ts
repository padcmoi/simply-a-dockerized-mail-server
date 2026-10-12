import { Module } from "@nestjs/common";
import { BrandingModule } from "../../core/branding/branding.module";
import { BrandingController } from "./branding.controller";

@Module({
  imports: [BrandingModule],
  controllers: [BrandingController],
})
export class BrandingApiModule {}
