import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Consignee } from '@hub-lanka/shared';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { RequirePermission } from '../identity/decorators/require-permission.decorator';
import type { RequestUser } from '../identity/types';
import { ConsigneesService } from './consignees.service';
import { CreateConsigneeDto } from './dto/create-consignee.dto';

@ApiTags('masterdata')
@Controller('masterdata/consignees')
export class ConsigneesController {
  constructor(private readonly consigneesService: ConsigneesService) {}

  @Get()
  @RequirePermission('masterdata.view')
  async list(@Query('includeInactive') includeInactive?: string): Promise<Consignee[]> {
    return this.consigneesService.list(includeInactive === 'true');
  }

  // Broader than masterdata.manage — Executive and Manager may both add
  // consignees (mirrors BR-17's commodity.create exception).
  @Post()
  @RequirePermission('masterdata.consignee.create')
  async create(
    @Body() dto: CreateConsigneeDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Consignee> {
    return this.consigneesService.create(dto, actor);
  }

  @Delete(':id')
  @RequirePermission('masterdata.manage')
  async deactivate(@Param('id') id: string, @CurrentUser() actor: RequestUser): Promise<Consignee> {
    return this.consigneesService.deactivate(id, actor);
  }
}
