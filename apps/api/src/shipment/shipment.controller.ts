import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { CancellationRequest, Shipment, ShipmentListResponse } from '@hub-lanka/shared';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { RequirePermission } from '../identity/decorators/require-permission.decorator';
import type { RequestUser } from '../identity/types';
import { CancellationRequestDto } from './dto/cancellation-request.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ListShipmentsQueryDto } from './dto/list-shipments-query.dto';
import { ReviewCancellationDto } from './dto/review-cancellation.dto';
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

  // Registered before ':id' so 'cancellation-requests' is never swallowed by the :id param route.
  @Get('cancellation-requests')
  @RequirePermission('shipment.cancellation.approve')
  async cancellationQueue(
    @Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED',
  ): Promise<CancellationRequest[]> {
    return this.shipmentService.listCancellationQueue(status ?? 'PENDING');
  }

  @Post('cancellation-requests/:requestId/approve')
  @RequirePermission('shipment.cancellation.approve')
  async approveCancellation(
    @Param('requestId') requestId: string,
    @Body() dto: ReviewCancellationDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<CancellationRequest> {
    return this.shipmentService.reviewCancellation(requestId, 'approve', actor, dto.note);
  }

  @Post('cancellation-requests/:requestId/reject')
  @RequirePermission('shipment.cancellation.approve')
  async rejectCancellation(
    @Param('requestId') requestId: string,
    @Body() dto: ReviewCancellationDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<CancellationRequest> {
    return this.shipmentService.reviewCancellation(requestId, 'reject', actor, dto.note);
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

  @Post(':id/cancellation-request')
  @RequirePermission('shipment.cancellation.request')
  async requestCancellation(
    @Param('id') id: string,
    @Body() dto: CancellationRequestDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<CancellationRequest> {
    return this.shipmentService.requestCancellation(id, dto.reason, actor);
  }

  @Post(':id/complete')
  @RequirePermission('shipment.completion.approve')
  async complete(@Param('id') id: string, @CurrentUser() actor: RequestUser): Promise<Shipment> {
    return this.shipmentService.complete(id, actor);
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

  /** BR-50/OQ-11: records actual flight departure, once, and resolves any open cut-off alert. */
  @Post(':id/actual-departure')
  @RequirePermission('shipment.actual_departure.record')
  async recordActualDeparture(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<Shipment> {
    return this.shipmentService.recordActualDeparture(id, actor);
  }
}
