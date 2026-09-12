import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { StorageModule } from '../storage/storage.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({
  // IdentityModule: PermissionsService. StorageModule: saving/reading the
  // uploaded file (local disk today; same abstraction Documents/Payment use).
  imports: [IdentityModule, StorageModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
