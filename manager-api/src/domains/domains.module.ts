import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DkimModule } from "../dkim/dkim.module";
import { VirtualUser } from "../users/virtual-user.entity";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";
import { VirtualDomain } from "./virtual-domain.entity";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualDomain, VirtualUser]), DkimModule],
  providers: [DomainsService],
  controllers: [DomainsController],
  exports: [DomainsService],
})
export class DomainsModule {}
