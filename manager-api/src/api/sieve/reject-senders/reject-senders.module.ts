import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SieveRejectSender } from "../../../core/entities/sieve-reject-sender.entity";
import { RejectSendersController } from "./reject-senders.controller";
import { RejectSendersService } from "./reject-senders.service";

@Module({
  imports: [TypeOrmModule.forFeature([SieveRejectSender])],
  providers: [RejectSendersService],
  controllers: [RejectSendersController],
})
export class RejectSendersModule {}
