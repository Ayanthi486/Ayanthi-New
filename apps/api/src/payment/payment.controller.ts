import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import type { PaymentListResponse, Payment as SharedPayment } from '@hub-lanka/shared';
import { memoryStorage } from 'multer';
import { AuthenticatedOnly } from '../identity/decorators/authenticated.decorator';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { RequirePermission } from '../identity/decorators/require-permission.decorator';
import type { RequestUser } from '../identity/types';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { PaymentService } from './payment.service';

// Infra-level backstop only (memoryStorage buffers the whole upload before
// our own PaymentService validates the actual configured RECEIPT_MAX_SIZE_MB
// business limit — see the Phase 6 report for why this isn't wired through
// ConfigService: this decorator's options evaluate at module-import time,
// before ConfigModule has loaded .env in local dev).
const MULTER_HARD_CEILING_BYTES = 25 * 1024 * 1024;

@ApiTags('payments')
@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('invoices/:invoiceId/payments')
  @RequirePermission('payment.record')
  @UseInterceptors(
    FileInterceptor('receipt', {
      storage: memoryStorage(),
      limits: { fileSize: MULTER_HARD_CEILING_BYTES },
    }),
  )
  async record(
    @Param('invoiceId') invoiceId: string,
    @Body() dto: RecordPaymentDto,
    @UploadedFile() receipt: Express.Multer.File | undefined,
    @Headers('Idempotency-Key') idempotencyKey: string | undefined,
    @CurrentUser() actor: RequestUser,
  ): Promise<SharedPayment> {
    return this.paymentService.record(
      invoiceId,
      dto,
      receipt
        ? { buffer: receipt.buffer, mimetype: receipt.mimetype, originalname: receipt.originalname }
        : undefined,
      idempotencyKey ?? null,
      actor,
    );
  }

  // Decision #11's OR pattern (mirrors InvoiceController): payment.view
  // (Manager) and payment.view.readonly (Director) are a genuine either/or.
  @Get('invoices/:invoiceId/payments')
  @AuthenticatedOnly()
  async listByInvoice(
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<PaymentListResponse> {
    return this.paymentService.listByInvoice(invoiceId, actor);
  }

  @Get('payments/:id/receipt')
  @AuthenticatedOnly()
  async getReceipt(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<StreamableFile> {
    const { buffer, contentType, filename } = await this.paymentService.getReceipt(id, actor);
    return new StreamableFile(buffer, {
      type: contentType,
      disposition: `inline; filename="${filename.replace(/"/g, '')}"`,
    });
  }
}
