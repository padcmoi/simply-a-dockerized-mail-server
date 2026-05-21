import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebadminAccount } from '../entities';
import { WebadminAccountsService } from './webadmin-accounts.service';
import { WebadminAccountsController } from './webadmin-accounts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WebadminAccount])],
  providers: [WebadminAccountsService],
  controllers: [WebadminAccountsController],
  exports: [WebadminAccountsService],
})
export class WebadminAccountsModule {}
