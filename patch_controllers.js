const fs = require('fs');

// 1. Commodities
let commCtrl = fs.readFileSync('apps/api/src/masterdata/commodities.controller.ts', 'utf8');
commCtrl = commCtrl.replace(
  `import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';`,
  `import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';`
);
commCtrl = commCtrl.replace(
  `import { CreateCommodityDto } from './dto/create-commodity.dto';`,
  `import { CreateCommodityDto } from './dto/create-commodity.dto';
import { UpdateCommodityDto } from './dto/update-commodity.dto';`
);
commCtrl = commCtrl.replace(
  `  @Delete(':id')`,
  `  @Patch(':id')
  @RequirePermission('masterdata.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCommodityDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Commodity> {
    return this.commoditiesService.update(id, dto, actor);
  }

  @Delete(':id')`
);
fs.writeFileSync('apps/api/src/masterdata/commodities.controller.ts', commCtrl);

// 2. Airports
let portCtrl = fs.readFileSync('apps/api/src/masterdata/airports.controller.ts', 'utf8');
portCtrl = portCtrl.replace(
  `import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';`,
  `import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';`
);
portCtrl = portCtrl.replace(
  `import { CreateAirportDto } from './dto/create-airport.dto';`,
  `import { CreateAirportDto } from './dto/create-airport.dto';
import { UpdateAirportDto } from './dto/update-airport.dto';`
);
portCtrl = portCtrl.replace(
  `  @Delete(':id')`,
  `  @Patch(':id')
  @RequirePermission('masterdata.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAirportDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Airport> {
    return this.airportsService.update(id, dto, actor);
  }

  @Delete(':id')`
);
fs.writeFileSync('apps/api/src/masterdata/airports.controller.ts', portCtrl);

// 3. Flights
let flightCtrl = fs.readFileSync('apps/api/src/masterdata/flights.controller.ts', 'utf8');
flightCtrl = flightCtrl.replace(
  `import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';`,
  `import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';`
);
flightCtrl = flightCtrl.replace(
  `import { CreateFlightDto } from './dto/create-flight.dto';`,
  `import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';`
);
flightCtrl = flightCtrl.replace(
  `  @Delete(':id')`,
  `  @Patch(':id')
  @RequirePermission('masterdata.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFlightDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Flight> {
    return this.flightsService.update(id, dto, actor);
  }

  @Delete(':id')`
);
fs.writeFileSync('apps/api/src/masterdata/flights.controller.ts', flightCtrl);

