const fs = require('fs');

// 1. Commodities
let commService = fs.readFileSync('apps/api/src/masterdata/commodities.service.ts', 'utf8');
commService = commService.replace(
  `import type { Commodity, CreateCommodityRequest } from '@hub-lanka/shared';`,
  `import type { Commodity, CreateCommodityRequest, UpdateCommodityRequest } from '@hub-lanka/shared';`
);
commService = commService.replace(
  `  async deactivate`,
  `  async update(id: string, input: UpdateCommodityRequest, actor: RequestUser): Promise<Commodity> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.commodity.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Commodity not found');
        return tx.commodity.update({
          where: { id },
          data: {
            name: input.name,
            code: input.code,
            delayHours: parseTime24(input.delayHours),
          },
        });
      },
    );
    return toCommodity(updated);
  }

  async deactivate`
);
fs.writeFileSync('apps/api/src/masterdata/commodities.service.ts', commService);

// 2. Airports
let portService = fs.readFileSync('apps/api/src/masterdata/airports.service.ts', 'utf8');
portService = portService.replace(
  `import type { Airport, CreateAirportRequest } from '@hub-lanka/shared';`,
  `import type { Airport, CreateAirportRequest, UpdateAirportRequest } from '@hub-lanka/shared';`
);
portService = portService.replace(
  `  async deactivate`,
  `  async update(id: string, input: UpdateAirportRequest, actor: RequestUser): Promise<Airport> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.airport.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Airport not found');
        return tx.airport.update({
          where: { id },
          data: {
            name: input.name,
            code: input.code,
          },
        });
      },
    );
    return toAirport(updated);
  }

  async deactivate`
);
fs.writeFileSync('apps/api/src/masterdata/airports.service.ts', portService);

// 3. Flights
let flightService = fs.readFileSync('apps/api/src/masterdata/flights.service.ts', 'utf8');
flightService = flightService.replace(
  `import type { CreateFlightRequest, Flight } from '@hub-lanka/shared';`,
  `import type { CreateFlightRequest, Flight, UpdateFlightRequest } from '@hub-lanka/shared';`
);
flightService = flightService.replace(
  `  async deactivate`,
  `  async update(id: string, input: UpdateFlightRequest, actor: RequestUser): Promise<Flight> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.flight.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Flight not found');
        return tx.flight.update({
          where: { id },
          data: {
            airlineId: input.airlineId,
            flightNo: input.flightNo,
            depTime: parseTime24(input.depTime),
          },
          include: { airline: true },
        });
      },
    );
    return toFlight(updated);
  }

  async deactivate`
);
fs.writeFileSync('apps/api/src/masterdata/flights.service.ts', flightService);

