import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../common/zod.pipe'
import { DomainsService } from './domains.service'
import { CreateDomainDto, UpdateDomainDto, createDomainSchema, updateDomainSchema } from './domains.validation'

@ApiTags('domains')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('domains')
export class DomainsController {
  constructor(private readonly svc: DomainsService) {}

  @Get()                    list()                                                                                     { return this.svc.list() }
  @Get(':id')               get(@Param('id', ParseIntPipe) id: number)                                                  { return this.svc.get(id) }
  @Post()                   create(@Body(new ZodValidationPipe(createDomainSchema)) body: CreateDomainDto)              { return this.svc.create(body) }
  @Patch(':id')             update(@Param('id', ParseIntPipe) id: number, @Body(new ZodValidationPipe(updateDomainSchema)) body: UpdateDomainDto) { return this.svc.update(id, body) }
  @Delete(':id')            remove(@Param('id', ParseIntPipe) id: number)                                               { return this.svc.remove(id) }
}
