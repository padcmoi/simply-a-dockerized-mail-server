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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { SieveService } from './sieve.service';
import { CreateSieveRejectDto } from './dto/create-sieve-reject.dto';

@ApiTags('sieve')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'sieve/reject-senders', version: '1' })
export class SieveController {
  constructor(private readonly sieve: SieveService) {}

  @Get()
  @Roles('admin', 'owner')
  list() {
    return this.sieve.list();
  }

  @Post()
  @Roles('admin', 'owner')
  create(@Body() dto: CreateSieveRejectDto) {
    return this.sieve.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'owner')
  toggle(@Param('id', ParseIntPipe) id: number, @Body('enabled', ParseIntPipe) enabled: number) {
    return this.sieve.toggle(id, enabled);
  }

  @Delete(':id')
  @Roles('admin', 'owner')
  @HttpCode(200)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sieve.remove(id);
  }
}
