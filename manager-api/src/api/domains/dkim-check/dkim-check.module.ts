import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DkimKeyEntity } from "../../../core/entities/dkim-key.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { CustomPermissionGuardModule } from "../../../core/custom-permission-guard/custom-permission-guard.module";
import { DkimCheckController } from "./dkim-check.controller";
import { DkimCheckService } from "./dkim-check.service";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualDomain, DkimKeyEntity]), CustomPermissionGuardModule],
  controllers: [DkimCheckController],
  providers: [DkimCheckService],
})
export class DomainsDkimCheckModule {}
