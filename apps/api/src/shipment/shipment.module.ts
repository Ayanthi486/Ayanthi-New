import { Module } from '@nestjs/common';
import { CutoffModule } from '../cutoff/cutoff.module';
import { DocumentsModule } from '../documents/documents.module';
import { IdentityModule } from '../identity/identity.module';
import { RatesModule } from '../rates/rates.module';
import { ShipmentController } from './shipment.controller';
import { ShipmentService } from './shipment.service';

@Module({
  // RatesModule exports RatesService — ShipmentService#setBuyingRate
  // resolves the effective rate through it (ARCHITECTURE §2 module
  // boundary: shipment talks to rates only through its public service).
  // DocumentsModule exports DocumentsService — ShipmentService#update calls
  // its openStaleIssuedDraftsIfNeeded hook (Phase 7 decision #6).
  // CutoffModule exports CutoffService — ShipmentService#changeStatus
  // resolves any open cut-off alert through it when transitioning to
  // Departed (Phase 8). IdentityModule exports PermissionsService —
  // changeStatus's value-dependent shipment.status.payment check.
  imports: [RatesModule, DocumentsModule, CutoffModule, IdentityModule],
  controllers: [ShipmentController],
  providers: [ShipmentService],
})
export class ShipmentModule {}
