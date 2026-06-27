import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SieveRejectSender } from "./sieve-reject-sender.entity";
import { SieveController } from "./sieve.controller";
import { SieveService } from "./sieve.service";

@Module({
  imports: [TypeOrmModule.forFeature([SieveRejectSender])],
  providers: [SieveService],
  controllers: [SieveController],
})
export class SieveModule {}
