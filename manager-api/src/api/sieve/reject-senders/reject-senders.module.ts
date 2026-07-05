import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SieveRejectSender } from "../../../core/entities/sieve-reject-sender.entity";
import { CustomPermissionGuardModule } from "../../../core/custom-permission-guard/custom-permission-guard.module";
import { RejectSendersController } from "./reject-senders.controller";
import { RejectSendersService } from "./reject-senders.service";

@Module({
  imports: [TypeOrmModule.forFeature([SieveRejectSender]), CustomPermissionGuardModule],
  providers: [RejectSendersService],
  controllers: [RejectSendersController],
})
export class RejectSendersModule {}
