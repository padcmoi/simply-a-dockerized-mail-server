import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { VirtualDomain } from "../../../core/entities/virtual-domain.entity";
import { VirtualUser } from "../../../core/entities/virtual-user.entity";
import { RecipientsController } from "./recipients.controller";
import { RecipientsService } from "./recipients.service";

@Module({
  imports: [TypeOrmModule.forFeature([VirtualUser, VirtualDomain])],
  providers: [RecipientsService],
  controllers: [RecipientsController],
  exports: [RecipientsService],
})
export class DomainsRecipientsModule {}
