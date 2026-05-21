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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import {
  OpenApiChangeUserPassword,
  OpenApiCreateUser,
  OpenApiDeleteUser,
  OpenApiGetUser,
  OpenApiListUsers,
  OpenApiUpdateUser,
} from './users.openapi';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles('admin', 'owner')
  @OpenApiListUsers()
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  @Roles('admin', 'owner', 'user')
  @OpenApiGetUser()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.users.findOne(id);
  }

  @Post()
  @Roles('admin', 'owner')
  @OpenApiCreateUser()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'owner')
  @OpenApiUpdateUser()
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Put(':id/password')
  @Roles('admin', 'owner', 'user')
  @HttpCode(200)
  @OpenApiChangeUserPassword()
  changePassword(@Param('id', ParseIntPipe) id: number, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(id, dto.password);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(200)
  @OpenApiDeleteUser()
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.users.remove(id);
  }
}
