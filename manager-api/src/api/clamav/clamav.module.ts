import { Module } from "@nestjs/common";
import { ClamavCoreModule } from "../../core/clamav/clamav.module";
import { CustomPermissionGuardModule } from "../../core/custom-permission-guard/custom-permission-guard.module";
import { ClamavController } from "./clamav.controller";

@Module({
  imports: [CustomPermissionGuardModule, ClamavCoreModule],
  controllers: [ClamavController],
})
export class ClamavApiModule {}
