import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PrintingModule } from '../printing/printing.module';
import { StorageModule } from '../storage/storage.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentRenderQueueService } from './rendering/document-render-queue.service';

@Module({
  // IdentityModule: PermissionsService. PrintingModule: PrinterAdapter
  // (BR-36). StorageModule: reading a stored PDF back for download — the
  // API's HTTP process never renders (ARCHITECTURE §11); it only enqueues
  // via DocumentRenderQueueService and reads the worker's stored result.
  imports: [IdentityModule, PrintingModule, StorageModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentRenderQueueService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
