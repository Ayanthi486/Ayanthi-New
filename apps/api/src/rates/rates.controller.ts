import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { RateTableEntry } from '@hub-lanka/shared';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { RequirePermission } from '../identity/decorators/require-permission.decorator';
import type { RequestUser } from '../identity/types';
import { CreateRateDto } from './dto/create-rate.dto';
import { RatesService } from './rates.service';

/** Manager-only throughout (rate.table.manage) — see the RatesService/schema.prisma model comment for why there is no update-value route. */
@ApiTags('rates')
@RequirePermission('rate.table.manage')
@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Get()
  async list(@Query('airlineId') airlineId?: string): Promise<RateTableEntry[]> {
    return this.ratesService.list(airlineId);
  }

  @Post()
  async create(
    @Body() dto: CreateRateDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<RateTableEntry> {
    return this.ratesService.create(dto, actor);
  }
}
