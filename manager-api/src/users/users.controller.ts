import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ZodValidationPipe } from "../common/zod.pipe";
import { UsersService } from "./users.service";
import { CreateUserDto, UpdateUserDto, createUserSchema, updateUserSchema } from "./users.validation";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"))
@Controller("users")
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get() list(@Query("domain") domain?: string) {
    return this.svc.list(domain);
  }
  @Get(":id") get(@Param("id", ParseIntPipe) id: number) {
    return this.svc.get(id);
  }
  @Post() create(@Body(new ZodValidationPipe(createUserSchema)) body: CreateUserDto) {
    return this.svc.create(body);
  }
  @Patch(":id") update(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserDto
  ) {
    return this.svc.update(id, body);
  }
  @Delete(":id") remove(@Param("id", ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
