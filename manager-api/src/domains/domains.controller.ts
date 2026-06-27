import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ZodValidationPipe } from "../common/zod.pipe";
import { DomainsService } from "./domains.service";
import { CreateDomainDto, UpdateDomainDto, createDomainSchema, updateDomainSchema } from "./domains.validation";

@ApiTags("domains")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"))
@Controller("domains")
export class DomainsController {
  constructor(private readonly svc: DomainsService) {}

  @Get() list() {
    return this.svc.list();
  }
  @Get(":id") get(@Param("id", ParseIntPipe) id: number) {
    return this.svc.get(id);
  }
  @Post() create(@Body(new ZodValidationPipe(createDomainSchema)) body: CreateDomainDto) {
    return this.svc.create(body);
  }
  @Patch(":id") update(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateDomainSchema)) body: UpdateDomainDto
  ) {
    return this.svc.update(id, body);
  }
  @Delete(":id") remove(@Param("id", ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }

  @Get(":id/dkim") async listDkim(@Param("id", ParseIntPipe) id: number) {
    const d = await this.svc.get(id);
    return this.svc.listDkim(d.domain);
  }

  @Post(":id/dkim/rotate") async rotateDkim(@Param("id", ParseIntPipe) id: number) {
    const d = await this.svc.get(id);
    return this.svc.rotateDkim(d.domain);
  }

  @Delete(":id/dkim") async removeDkim(@Param("id", ParseIntPipe) id: number, @Query("selector") selector: string) {
    const d = await this.svc.get(id);
    return this.svc.removeDkim(d.domain, selector);
  }
}
