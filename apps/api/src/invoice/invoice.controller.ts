import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Invoice } from '@hub-lanka/shared';
import { AuthenticatedOnly } from '../identity/decorators/authenticated.decorator';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { RequirePermission } from '../identity/decorators/require-permission.decorator';
import type { RequestUser } from '../identity/types';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoiceService } from './invoice.service';

@ApiTags('invoices')
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @RequirePermission('invoice.manage')
  async create(@Body() dto: CreateInvoiceDto, @CurrentUser() actor: RequestUser): Promise<Invoice> {
    return this.invoiceService.create(dto, actor);
  }

  // Registered before ':id' so 'by-shipment' is never swallowed by the :id param route.
  // @AuthenticatedOnly(): decision #11 — invoice.view (Manager) and
  // invoice.view.readonly (Director) are a genuine either/or that a single
  // @RequirePermission key can't express; InvoiceService checks both.
  @Get('by-shipment/:shipmentId')
  @AuthenticatedOnly()
  async getByShipmentId(
    @Param('shipmentId') shipmentId: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<Invoice> {
    return this.invoiceService.getByShipmentId(shipmentId, actor);
  }

  @Get(':id')
  @AuthenticatedOnly()
  async getById(@Param('id') id: string, @CurrentUser() actor: RequestUser): Promise<Invoice> {
    return this.invoiceService.getById(id, actor);
  }

  @Patch(':id')
  @RequirePermission('invoice.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Invoice> {
    return this.invoiceService.update(id, dto, actor);
  }

  // ARCHITECTURE §7: Idempotency-Key honoured on invoice issue.
  @Post(':id/issue')
  @RequirePermission('invoice.manage')
  async issue(
    @Param('id') id: string,
    @Headers('Idempotency-Key') idempotencyKey: string | undefined,
    @CurrentUser() actor: RequestUser,
  ): Promise<Invoice> {
    return this.invoiceService.issue(id, idempotencyKey ?? null, actor);
  }
}
