import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { CostSheet } from '@hub-lanka/shared';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { RequirePermission } from '../identity/decorators/require-permission.decorator';
import type { RequestUser } from '../identity/types';
import { CostSheetService } from './costsheet.service';
import { CreateCostSheetDto } from './dto/create-cost-sheet.dto';
import { UpdateCostSheetDto } from './dto/update-cost-sheet.dto';

@ApiTags('costsheets')
@Controller('costsheets')
export class CostSheetController {
  constructor(private readonly costSheetService: CostSheetService) {}

  @Post()
  @RequirePermission('costsheet.prepare')
  async create(
    @Body() dto: CreateCostSheetDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<CostSheet> {
    return this.costSheetService.create(dto, actor);
  }

  // Registered before ':id' so 'by-shipment' is never swallowed by the :id param route.
  @Get('by-shipment/:shipmentId')
  @RequirePermission('costsheet.view')
  async getByShipmentId(@Param('shipmentId') shipmentId: string): Promise<CostSheet> {
    return this.costSheetService.getByShipmentId(shipmentId);
  }

  @Get(':id')
  @RequirePermission('costsheet.view')
  async getById(@Param('id') id: string): Promise<CostSheet> {
    return this.costSheetService.getById(id);
  }

  // costsheet.prepare covers both Draft and Released editing (Executive +
  // Manager); the service additionally enforces costsheet.edit_approved
  // (Manager only) once the sheet is Approved — see CostSheetService#update.
  @Patch(':id')
  @RequirePermission('costsheet.prepare')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCostSheetDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<CostSheet> {
    return this.costSheetService.update(id, dto, actor);
  }

  @Post(':id/release')
  @RequirePermission('costsheet.prepare')
  async release(@Param('id') id: string, @CurrentUser() actor: RequestUser): Promise<CostSheet> {
    return this.costSheetService.release(id, actor);
  }

  @Post(':id/approve')
  @RequirePermission('costsheet.approve')
  async approve(@Param('id') id: string, @CurrentUser() actor: RequestUser): Promise<CostSheet> {
    return this.costSheetService.approve(id, actor);
  }
}
