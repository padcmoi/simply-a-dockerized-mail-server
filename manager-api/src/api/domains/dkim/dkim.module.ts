import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DkimModule } from "../../../core/dkim/dkim.module";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { CustomPermissionGuardModule } from "../../../core/custom-permission-guard/custom-permission-guard.module";
import { DkimController } from "./dkim.controller";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualDomain]), DkimModule, CustomPermissionGuardModule],
  controllers: [DkimController],
})
export class DomainsDkimModule {}
