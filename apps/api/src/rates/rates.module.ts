import { Module } from '@nestjs/common';
import { RatesController } from './rates.controller';
import { RatesService } from './rates.service';

@Module({
  controllers: [RatesController],
  providers: [RatesService],
  // ShipmentService injects RatesService directly for buying-rate resolution.
  exports: [RatesService],
})
export class RatesModule {}
