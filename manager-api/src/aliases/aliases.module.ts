import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VirtualAlias } from '../entities';
import { AliasesService } from './aliases.service';
import { AliasesController } from './aliases.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VirtualAlias])],
  providers: [AliasesService],
  controllers: [AliasesController],
  exports: [AliasesService],
})
export class AliasesModule {}
