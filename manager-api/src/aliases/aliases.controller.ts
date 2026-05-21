import {
  Body,
  Controller,
  DefaultValuePipe,
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
import { AliasesService } from './aliases.service';
import { CreateAliasDto } from './dto/create-alias.dto';
import { UpdateAliasDto } from './dto/update-alias.dto';

@ApiTags('aliases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'aliases', version: '1' })
export class AliasesController {
  constructor(private readonly aliases: AliasesService) {}

  @Get()
  @Roles('admin', 'owner')
  list(
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('domain') domain?: string,
  ) {
    return this.aliases.list(page, limit, search, domain);
  }

  @Get(':id')
  @Roles('admin', 'owner')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.aliases.findOne(id);
  }

  @Post()
  @Roles('admin', 'owner')
  create(@Body() dto: CreateAliasDto) {
    return this.aliases.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'owner')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAliasDto) {
    return this.aliases.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'owner')
  @HttpCode(200)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.aliases.remove(id);
  }
}
