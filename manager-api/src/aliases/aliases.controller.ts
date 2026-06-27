import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../common/zod.pipe'
import { AliasesService } from './aliases.service'
import { CreateAliasDto, UpdateAliasDto, createAliasSchema, updateAliasSchema } from './aliases.validation'

@ApiTags('aliases')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('aliases')
export class AliasesController {
  constructor(private readonly svc: AliasesService) {}

  @Get()         list(@Query('domain') domain?: string)                                                                  { return this.svc.list(domain) }
  @Get(':id')    get(@Param('id', ParseIntPipe) id: number)                                                               { return this.svc.get(id) }
  @Post()        create(@Body(new ZodValidationPipe(createAliasSchema)) body: CreateAliasDto)                             { return this.svc.create(body) }
  @Patch(':id')  update(@Param('id', ParseIntPipe) id: number, @Body(new ZodValidationPipe(updateAliasSchema)) body: UpdateAliasDto) { return this.svc.update(id, body) }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number)                                                            { return this.svc.remove(id) }
}
