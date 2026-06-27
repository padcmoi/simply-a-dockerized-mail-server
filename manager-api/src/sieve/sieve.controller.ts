import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ZodValidationPipe } from "../common/zod.pipe";
import { SieveService } from "./sieve.service";

const createSchema = z.object({ sender: z.string().min(2).max(255) });
const toggleSchema = z.object({ enabled: z.boolean() });

@ApiTags("sieve")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"))
@Controller("sieve/reject-senders")
export class SieveController {
  constructor(private readonly svc: SieveService) {}

  @Get() list() {
    return this.svc.list();
  }
  @Post() create(@Body(new ZodValidationPipe(createSchema)) body: z.infer<typeof createSchema>) {
    return this.svc.create(body.sender);
  }
  @Patch(":id") toggle(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(toggleSchema)) body: z.infer<typeof toggleSchema>
  ) {
    return this.svc.toggle(id, body.enabled);
  }
  @Delete(":id") remove(@Param("id", ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
