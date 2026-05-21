import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { WebadminAccountsService } from './webadmin-accounts.service';
import { CreateWebadminAccountDto } from './dto/create-webadmin-account.dto';
import { UpdateWebadminAccountDto } from './dto/update-webadmin-account.dto';
import { ChangeWebadminPasswordDto } from './dto/change-webadmin-password.dto';

@ApiTags('webadmin-accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'webadmin-accounts', version: '1' })
export class WebadminAccountsController {
  constructor(private readonly accounts: WebadminAccountsService) {}

  /** Current authenticated principal (handy for the SPA after login). */
  @Get('me')
  me(@Req() req: { user?: { sub?: string; email?: string; role?: string } }) {
    return { principal: req.user };
  }

  @Get()
  @Roles('root', 'admin')
  list() {
    return this.accounts.list();
  }

  @Get(':id')
  @Roles('root', 'admin')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.accounts.findOne(id);
  }

  @Post()
  @Roles('root', 'admin')
  create(@Body() dto: CreateWebadminAccountDto) {
    return this.accounts.create(dto);
  }

  @Patch(':id')
  @Roles('root', 'admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWebadminAccountDto) {
    return this.accounts.update(id, dto);
  }

  @Put(':id/password')
  @Roles('root', 'admin')
  @HttpCode(200)
  changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeWebadminPasswordDto,
  ) {
    return this.accounts.changePassword(id, dto.password);
  }

  @Delete(':id')
  @Roles('root', 'admin')
  @HttpCode(200)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.accounts.remove(id);
  }
}
