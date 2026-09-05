import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { StorageModule } from '../storage/storage.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  // IdentityModule exports PermissionsService (the payment.view /
  // payment.view.readonly OR check); StorageModule exports StorageService
  // for receipt upload/download.
  imports: [IdentityModule, StorageModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
