import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminRole } from '@hub-lanka/shared';
import { RequirePermission } from './decorators/require-permission.decorator';
import { RolesService } from './roles.service';

@ApiTags('roles')
@RequirePermission('identity.user.manage')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  async list(): Promise<AdminRole[]> {
    return this.rolesService.list();
  }
}
