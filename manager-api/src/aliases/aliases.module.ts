import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AliasesController } from './aliases.controller'
import { AliasesService } from './aliases.service'
import { VirtualAlias } from './virtual-alias.entity'

@Module({
  imports: [TypeOrmModule.forFeature([VirtualAlias])],
  providers: [AliasesService],
  controllers: [AliasesController],
})
export class AliasesModule {}
