import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SieveRejectSender } from '../entities';
import { SieveService } from './sieve.service';
import { SieveController } from './sieve.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SieveRejectSender])],
  providers: [SieveService],
  controllers: [SieveController],
  exports: [SieveService],
})
export class SieveModule {}
