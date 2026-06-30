import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DkimModule } from "../../../core/dkim/dkim.module";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { DkimController } from "./dkim.controller";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualDomain]), DkimModule],
  controllers: [DkimController],
})
export class DomainsDkimModule {}
