import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { QuotasService } from './quotas.service';

@ApiTags('quotas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'quotas', version: '1' })
export class QuotasController {
  constructor(private readonly quotas: QuotasService) {}

  @Get('domains')
  @Roles('admin', 'owner')
  listDomains() {
    return this.quotas.listDomains();
  }

  @Get('domains/:domain')
  @Roles('admin', 'owner')
  getDomain(@Param('domain') domain: string) {
    return this.quotas.getDomain(domain);
  }

  @Get('users')
  @Roles('admin', 'owner')
  listUsers(@Query('domain') domain?: string) {
    return this.quotas.listUsers(domain);
  }

  @Get('users/:email')
  @Roles('admin', 'owner', 'user')
  getUser(@Param('email') email: string) {
    return this.quotas.getUser(email);
  }
}
