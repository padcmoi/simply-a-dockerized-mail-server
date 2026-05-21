import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import {
  OpenApiCreateAccount,
  OpenApiDeleteAccount,
  OpenApiGetAccount,
  OpenApiListAccounts,
} from './accounts.openapi';

@ApiTags('accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'accounts', version: '1' })
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  @Roles('admin')
  @OpenApiListAccounts()
  list() {
    return this.accounts.list();
  }

  @Get(':id')
  @Roles('admin')
  @OpenApiGetAccount()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.accounts.findOne(id);
  }

  @Post()
  @Roles('admin')
  @OpenApiCreateAccount()
  create(@Body() dto: CreateAccountDto) {
    return this.accounts.create(dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(200)
  @OpenApiDeleteAccount()
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.accounts.remove(id);
  }
}
