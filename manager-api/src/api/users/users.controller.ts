import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ZodValidationPipe } from "../../core/common/zod.pipe";
import { CreateUserDocs, GetUserDocs, ListUsersDocs, RemoveUserDocs, UpdateUserDocs, UsersApi } from "./users.openapi";
import { UsersService } from "./users.service";
import { CreateUserDto, UpdateUserDto, createUserSchema, updateUserSchema } from "./users.validation";

@UsersApi()
@Controller("users")
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get()
  @ListUsersDocs()
  list(@Query("domain") domain?: string) {
    return this.svc.list(domain);
  }

  @Get(":id")
  @GetUserDocs()
  get(@Param("id", ParseIntPipe) id: number) {
    return this.svc.get(id);
  }

  @Post()
  @CreateUserDocs()
  create(@Body(new ZodValidationPipe(createUserSchema)) body: CreateUserDto) {
    return this.svc.create(body);
  }

  @Patch(":id")
  @UpdateUserDocs()
  update(@Param("id", ParseIntPipe) id: number, @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserDto) {
    return this.svc.update(id, body);
  }

  @Delete(":id")
  @RemoveUserDocs()
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
