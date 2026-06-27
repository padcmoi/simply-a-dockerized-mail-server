import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { QuotasController } from './quotas.controller'
import { VirtualQuotaDomain } from './virtual-quota-domain.entity'
import { VirtualQuotaUser } from './virtual-quota-user.entity'

@Module({
  imports: [TypeOrmModule.forFeature([VirtualQuotaDomain, VirtualQuotaUser])],
  controllers: [QuotasController],
})
export class QuotasModule {}
