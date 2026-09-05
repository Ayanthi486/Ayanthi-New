import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { CutoffAlert } from '@hub-lanka/shared';
import { AuthenticatedOnly } from '../identity/decorators/authenticated.decorator';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { RequirePermission } from '../identity/decorators/require-permission.decorator';
import type { RequestUser } from '../identity/types';
import { CutoffService } from './cutoff.service';

@ApiTags('cutoff')
@Controller()
export class CutoffController {
  constructor(private readonly cutoffService: CutoffService) {}

  // No separate view permission — cut-off state is additional data on the
  // already-visible schedule (shipment.view, all three roles); the guard
  // only needs to confirm the caller is authenticated.
  @Get('cutoff/active')
  @AuthenticatedOnly()
  async listActive(): Promise<CutoffAlert[]> {
    return this.cutoffService.listActive();
  }

  @Post('shipments/:id/cutoff/acknowledge')
  @RequirePermission('cutoff.acknowledge')
  async acknowledge(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<CutoffAlert> {
    return this.cutoffService.acknowledge(id, actor);
  }
}
