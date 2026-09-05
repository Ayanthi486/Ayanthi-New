import { Body, Controller, Param, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Shipment } from '@hub-lanka/shared';
import { CurrentUser } from '../identity/decorators/current-user.decorator';
import { RequirePermission } from '../identity/decorators/require-permission.decorator';
import type { RequestUser } from '../identity/types';
import { CargoService } from './cargo.service';
import { SetCargoDto } from './dto/set-cargo.dto';

@ApiTags('cargo')
@Controller('shipments/:id/cargo')
export class CargoController {
  constructor(private readonly cargoService: CargoService) {}

  @Patch()
  @RequirePermission('cargo.boxweight.enter')
  async setBoxWeight(
    @Param('id') id: string,
    @Body() dto: SetCargoDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Shipment> {
    return this.cargoService.setBoxWeight(id, dto, actor);
  }
}
