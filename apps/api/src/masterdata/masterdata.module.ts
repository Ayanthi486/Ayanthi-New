import { Module } from '@nestjs/common';
import { AirlinesController } from './airlines.controller';
import { AirlinesService } from './airlines.service';
import { AirportsController } from './airports.controller';
import { AirportsService } from './airports.service';
import { CommoditiesController } from './commodities.controller';
import { CommoditiesService } from './commodities.service';
import { ConsigneesController } from './consignees.controller';
import { ConsigneesService } from './consignees.service';
import { ShippersController } from './shippers.controller';
import { ShippersService } from './shippers.service';

@Module({
  controllers: [
    ShippersController,
    ConsigneesController,
    AirlinesController,
    AirportsController,
    CommoditiesController,
  ],
  providers: [
    ShippersService,
    ConsigneesService,
    AirlinesService,
    AirportsService,
    CommoditiesService,
  ],
})
export class MasterdataModule {}
