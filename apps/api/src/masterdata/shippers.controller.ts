import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Shipper } from '@hub-lanka/shared';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { RequirePermission } from '../identity/decorators/require-permission.decorator';
import type { RequestUser } from '../identity/types';
import { CreateShipperDto } from './dto/create-shipper.dto';
import { ShippersService } from './shippers.service';

@ApiTags('masterdata')
@Controller('masterdata/shippers')
export class ShippersController {
  constructor(private readonly shippersService: ShippersService) {}

  @Get()
  @RequirePermission('masterdata.view')
  async list(@Query('includeInactive') includeInactive?: string): Promise<Shipper[]> {
    return this.shippersService.list(includeInactive === 'true');
  }

  // Broader than masterdata.manage — Executive and Manager may both add
  // shippers (mirrors BR-17's commodity.create exception).
  @Post()
  @RequirePermission('masterdata.shipper.create')
  async create(@Body() dto: CreateShipperDto, @CurrentUser() actor: RequestUser): Promise<Shipper> {
    return this.shippersService.create(dto, actor);
  }

  @Delete(':id')
  @RequirePermission('masterdata.manage')
  async deactivate(@Param('id') id: string, @CurrentUser() actor: RequestUser): Promise<Shipper> {
    return this.shippersService.deactivate(id, actor);
  }
}
