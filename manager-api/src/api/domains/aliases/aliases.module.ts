import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { VirtualAlias } from "../../../core/entities/virtual-alias.entity";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { AliasesController } from "./aliases.controller";
import { AliasesService } from "./aliases.service";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualAlias, VirtualDomain])],
  providers: [AliasesService],
  controllers: [AliasesController],
})
export class DomainsAliasesModule {}
