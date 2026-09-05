import { Module } from '@nestjs/common';
import { LocalDiskStorageAdapter, StorageService } from './storage.service';

@Module({
  providers: [{ provide: StorageService, useClass: LocalDiskStorageAdapter }],
  exports: [StorageService],
})
export class StorageModule {}
