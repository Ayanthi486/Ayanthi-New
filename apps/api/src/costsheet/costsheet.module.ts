import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { CostSheetController } from './costsheet.controller';
import { CostSheetService } from './costsheet.service';

@Module({
  // IdentityModule exports PermissionsService — CostSheetService#update
  // needs it for the state-dependent costsheet.edit_approved check.
  imports: [IdentityModule],
  controllers: [CostSheetController],
  providers: [CostSheetService],
})
export class CostSheetModule {}
