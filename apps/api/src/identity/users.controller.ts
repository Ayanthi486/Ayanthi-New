import { Body, Controller, Get, Param, Patch, Post, Delete } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminUser } from '@hub-lanka/shared';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequirePermission } from './decorators/require-permission.decorator';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { RequestUser } from './types';
import { UsersService } from './users.service';

@ApiTags('users')
@RequirePermission('identity.user.manage')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(): Promise<AdminUser[]> {
    return this.usersService.list();
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @CurrentUser() actor: RequestUser): Promise<AdminUser> {
    return this.usersService.create(dto, actor);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<AdminUser> {
    return this.usersService.update(id, dto, actor);
  }

  @Post(':id/roles')
  async assignRole(
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<AdminUser> {
    return this.usersService.assignRole(id, dto.roleId, actor);
  }

  @Delete(':id/roles/:roleId')
  async unassignRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<AdminUser> {
    return this.usersService.unassignRole(id, roleId, actor);
  }
}
