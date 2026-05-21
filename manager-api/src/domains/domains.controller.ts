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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { DomainsService } from './domains.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';
import { ListDomainsQueryDto } from './dto/list-domains-query.dto';

@ApiTags('domains')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'domains', version: '1' })
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Get()
  @Roles('admin', 'owner')
  list(@Query() query: ListDomainsQueryDto) {
    return this.domains.list(query);
  }

  @Get(':id')
  @Roles('admin', 'owner')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.domains.findOne(id);
  }

  @Get(':id/dns')
  @Roles('admin', 'owner')
  dns(@Param('id', ParseIntPipe) id: number) {
    return this.domains.dns(id);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateDomainDto) {
    return this.domains.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'owner')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDomainDto) {
    return this.domains.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(200)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.domains.remove(id);
  }
}
