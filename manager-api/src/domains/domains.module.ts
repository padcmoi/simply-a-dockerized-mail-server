import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DkimModule } from "../dkim/dkim.module";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";
import { VirtualDomain } from "./virtual-domain.entity";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualDomain]), DkimModule],
  providers: [DomainsService],
  controllers: [DomainsController],
  exports: [DomainsService],
})
export class DomainsModule {}
