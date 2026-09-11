import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Airport } from '@hub-lanka/shared';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { RequirePermission } from '../identity/decorators/require-permission.decorator';
import type { RequestUser } from '../identity/types';
import { AirportsService } from './airports.service';
import { CreateAirportDto } from './dto/create-airport.dto';

@ApiTags('masterdata')
@Controller('masterdata/airports')
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  @Get()
  @RequirePermission('masterdata.view')
  async list(@Query('includeInactive') includeInactive?: string): Promise<Airport[]> {
    return this.airportsService.list(includeInactive === 'true');
  }

  // Broader than masterdata.manage — Executive and Manager may both add
  // destinations (mirrors BR-17's commodity.create exception).
  @Post()
  @RequirePermission('masterdata.airport.create')
  async create(@Body() dto: CreateAirportDto, @CurrentUser() actor: RequestUser): Promise<Airport> {
    return this.airportsService.create(dto, actor);
  }

  @Delete(':id')
  @RequirePermission('masterdata.manage')
  async deactivate(@Param('id') id: string, @CurrentUser() actor: RequestUser): Promise<Airport> {
    return this.airportsService.deactivate(id, actor);
  }
}
