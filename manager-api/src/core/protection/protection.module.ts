import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Account } from "../entities/account.entity";
import { VirtualAlias } from "../entities/virtual-alias.entity";
import { VirtualDomain } from "../entities/virtual-domain.entity";
import { VirtualUser } from "../entities/virtual-user.entity";
import { ProtectionService } from "./protection.service";

@Module({
  imports: [TypeOrmModule.forFeature([Account, VirtualUser, VirtualAlias, VirtualDomain])],
  providers: [ProtectionService],
  exports: [ProtectionService],
})
export class ProtectionModule {}
