import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Commodity } from '@hub-lanka/shared';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { RequirePermission } from '../identity/decorators/require-permission.decorator';
import type { RequestUser } from '../identity/types';
import { CommoditiesService } from './commodities.service';
import { CreateCommodityDto } from './dto/create-commodity.dto';

@ApiTags('masterdata')
@Controller('masterdata/commodities')
export class CommoditiesController {
  constructor(private readonly commoditiesService: CommoditiesService) {}

  @Get()
  @RequirePermission('masterdata.view')
  async list(@Query('includeInactive') includeInactive?: string): Promise<Commodity[]> {
    return this.commoditiesService.list(includeInactive === 'true');
  }

  // BR-17: Executive and Manager may both add commodities — a broader grant
  // than masterdata.manage (Manager only), which is why this route uses its
  // own dedicated permission rather than the shared masterdata one.
  @Post()
  @RequirePermission('masterdata.commodity.create')
  async create(
    @Body() dto: CreateCommodityDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Commodity> {
    return this.commoditiesService.create(dto, actor);
  }

  @Delete(':id')
  @RequirePermission('masterdata.manage')
  async deactivate(@Param('id') id: string, @CurrentUser() actor: RequestUser): Promise<Commodity> {
    return this.commoditiesService.deactivate(id, actor);
  }
}
