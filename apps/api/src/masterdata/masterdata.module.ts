import { Module } from '@nestjs/common';
import { AirlinesController } from './airlines.controller';
import { AirlinesService } from './airlines.service';
import { AirportsController } from './airports.controller';
import { AirportsService } from './airports.service';
import { CommoditiesController } from './commodities.controller';
import { CommoditiesService } from './commodities.service';
import { ConsigneesController } from './consignees.controller';
import { ConsigneesService } from './consignees.service';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { ShippersController } from './shippers.controller';
import { ShippersService } from './shippers.service';

@Module({
  controllers: [
    ShippersController,
    ConsigneesController,
    AirlinesController,
    AirportsController,
    CommoditiesController,
    FlightsController,
  ],
  providers: [
    ShippersService,
    ConsigneesService,
    AirlinesService,
    AirportsService,
    CommoditiesService,
    FlightsService,
  ],
})
export class MasterdataModule {}
