import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Flight } from '@hub-lanka/shared';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { RequirePermission } from '../identity/decorators/require-permission.decorator';
import type { RequestUser } from '../identity/types';
import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { FlightsService } from './flights.service';

@ApiTags('masterdata')
@Controller('masterdata/flights')
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Get()
  @RequirePermission('masterdata.view')
  async list(@Query('includeInactive') includeInactive?: string): Promise<Flight[]> {
    return this.flightsService.list(includeInactive === 'true');
  }

  // Broader than masterdata.manage — Executive and Manager may both add flights.
  @Post()
  @RequirePermission('masterdata.flight.create')
  async create(@Body() dto: CreateFlightDto, @CurrentUser() actor: RequestUser): Promise<Flight> {
    return this.flightsService.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermission('masterdata.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFlightDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Flight> {
    return this.flightsService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermission('masterdata.manage')
  async deactivate(@Param('id') id: string, @CurrentUser() actor: RequestUser): Promise<Flight> {
    return this.flightsService.deactivate(id, actor);
  }
}
