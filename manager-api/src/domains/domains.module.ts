import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DomainsController } from './domains.controller'
import { DomainsService } from './domains.service'
import { VirtualDomain } from './virtual-domain.entity'

@Module({
  imports: [TypeOrmModule.forFeature([VirtualDomain])],
  providers: [DomainsService],
  controllers: [DomainsController],
  exports: [DomainsService],
})
export class DomainsModule {}
