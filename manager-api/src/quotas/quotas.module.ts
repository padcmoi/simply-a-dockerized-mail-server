import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VirtualQuotaDomain, VirtualQuotaUser } from '../entities';
import { QuotasService } from './quotas.service';
import { QuotasController } from './quotas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VirtualQuotaDomain, VirtualQuotaUser])],
  providers: [QuotasService],
  controllers: [QuotasController],
  exports: [QuotasService],
})
export class QuotasModule {}
