import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Shipment, ShipmentListResponse } from '@hub-lanka/shared';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { RequirePermission } from '../identity/decorators/require-permission.decorator';
import type { RequestUser } from '../identity/types';
import { ChangeShipmentStatusDto } from './dto/change-shipment-status.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ListShipmentsQueryDto } from './dto/list-shipments-query.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { ShipmentService } from './shipment.service';

@ApiTags('shipments')
@Controller('shipments')
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Get()
  @RequirePermission('shipment.view')
  async list(@Query() query: ListShipmentsQueryDto): Promise<ShipmentListResponse> {
    return this.shipmentService.list(query);
  }

  @Get(':id')
  @RequirePermission('shipment.view')
  async getById(@Param('id') id: string): Promise<Shipment> {
    return this.shipmentService.getById(id);
  }

  @Post()
  @RequirePermission('shipment.create')
  async create(
    @Body() dto: CreateShipmentDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Shipment> {
    return this.shipmentService.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermission('shipment.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Shipment> {
    return this.shipmentService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermission('shipment.delete.own')
  async delete(@Param('id') id: string, @CurrentUser() actor: RequestUser): Promise<Shipment> {
    return this.shipmentService.delete(id, actor);
  }

  /**
   * The direct, no-approval status dropdown (Schedule grid). Base permission
   * grants Pending/Confirmed/Cancelled/Departed; the extra Payment Pending/
   * Payment Received values are gated inside the service by
   * `shipment.status.payment` (a value-dependent check the declarative
   * decorator here can't express).
   */
  @Patch(':id/status')
  @RequirePermission('shipment.status.update')
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeShipmentStatusDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Shipment> {
    return this.shipmentService.changeStatus(id, dto, actor);
  }

  /** BR-44: Manager-only capture of the airline's currently effective rate onto this shipment. */
  @Post(':id/buying-rate')
  @RequirePermission('rate.buying.enter')
  async setBuyingRate(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<Shipment> {
    return this.shipmentService.setBuyingRate(id, actor);
  }
}
