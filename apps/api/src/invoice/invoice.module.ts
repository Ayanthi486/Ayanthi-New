import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';

@Module({
  // IdentityModule exports PermissionsService — InvoiceService needs it for
  // the OR view-permission check and the field-level exchange-rate/invoice-
  // number checks (decisions #11/#12).
  imports: [IdentityModule],
  controllers: [InvoiceController],
  providers: [InvoiceService],
})
export class InvoiceModule {}
