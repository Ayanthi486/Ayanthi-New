import { Module } from '@nestjs/common';
import { CutoffModule } from '../cutoff/cutoff.module';
import { DocumentsModule } from '../documents/documents.module';
import { RatesModule } from '../rates/rates.module';
import { ShipmentController } from './shipment.controller';
import { ShipmentService } from './shipment.service';

@Module({
  // RatesModule exports RatesService — ShipmentService#setBuyingRate
  // resolves the effective rate through it (ARCHITECTURE §2 module
  // boundary: shipment talks to rates only through its public service).
  // DocumentsModule exports DocumentsService — ShipmentService#update calls
  // its openStaleIssuedDraftsIfNeeded hook (Phase 7 decision #6).
  // CutoffModule exports CutoffService — ShipmentService#recordActualDeparture
  // resolves any open cut-off alert through it (Phase 8).
  imports: [RatesModule, DocumentsModule, CutoffModule],
  controllers: [ShipmentController],
  providers: [ShipmentService],
})
export class ShipmentModule {}
