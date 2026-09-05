import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { CargoController } from './cargo.controller';
import { CargoService } from './cargo.service';

@Module({
  // DocumentsModule exports DocumentsService — CargoService#setBoxWeight
  // calls its openStaleIssuedDraftsIfNeeded hook (Phase 7 decision #6).
  imports: [DocumentsModule],
  controllers: [CargoController],
  providers: [CargoService],
})
export class CargoModule {}
