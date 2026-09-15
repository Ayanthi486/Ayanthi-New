import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Airline } from '@hub-lanka/shared';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { RequirePermission } from '../identity/decorators/require-permission.decorator';
import type { RequestUser } from '../identity/types';
import { AirlinesService } from './airlines.service';
import { CreateAirlineDto } from './dto/create-airline.dto';
import { UpdateAirlineDto } from './dto/update-airline.dto';

@ApiTags('masterdata')
@Controller('masterdata/airlines')
export class AirlinesController {
  constructor(private readonly airlinesService: AirlinesService) {}

  @Get()
  @RequirePermission('masterdata.view')
  async list(@Query('includeInactive') includeInactive?: string): Promise<Airline[]> {
    return this.airlinesService.list(includeInactive === 'true');
  }

  // Broader than masterdata.manage — Executive and Manager may both add
  // airlines (needed to complete the flight-adding flow — see FlightsController).
  @Post()
  @RequirePermission('masterdata.airline.create')
  async create(@Body() dto: CreateAirlineDto, @CurrentUser() actor: RequestUser): Promise<Airline> {
    return this.airlinesService.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermission('masterdata.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAirlineDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Airline> {
    return this.airlinesService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermission('masterdata.manage')
  async deactivate(@Param('id') id: string, @CurrentUser() actor: RequestUser): Promise<Airline> {
    return this.airlinesService.deactivate(id, actor);
  }
}
