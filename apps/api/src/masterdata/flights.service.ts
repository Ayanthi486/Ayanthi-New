import { Injectable } from '@nestjs/common';
import type { CreateFlightRequest, Flight, UpdateFlightRequest } from '@hub-lanka/shared';
import { AuditService } from '../audit/audit.service';
import { NotFoundError, ValidationError } from '../common/errors/app-error';
import type { RequestUser } from '../identity/types';
import { PrismaService } from '../prisma/prisma.service';
import { parseTime24 } from '../shipment/shipment.util';
import { toFlight } from './masterdata.util';

const FLIGHT_WITH_AIRLINE_INCLUDE = { airline: { select: { name: true, code: true } } } as const;

/**
 * The "flight adding feature": airline + flight number + confirmed
 * departure time, captured once here rather than re-entered per shipment on
 * the Add Shipment form.
 */
@Injectable()
export class FlightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(includeInactive: boolean): Promise<Flight[]> {
    const rows = await this.prisma.flight.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: FLIGHT_WITH_AIRLINE_INCLUDE,
      orderBy: [{ airlineId: 'asc' }, { flightNo: 'asc' }],
    });
    return rows.map(toFlight);
  }

  async create(input: CreateFlightRequest, actor: RequestUser): Promise<Flight> {
    const airline = await this.prisma.airline.findFirst({
      where: { code: input.airlineCode },
    });
    if (!airline) {
      throw new ValidationError(`No airline found with code "${input.airlineCode}". Add it in Master Data first.`);
    }
    const created = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      (tx) =>
        tx.flight.create({
          data: {
            airlineId: airline.id,
            flightNo: input.flightNo,
            depTime: parseTime24(input.depTime),
          },
          include: FLIGHT_WITH_AIRLINE_INCLUDE,
        }),
    );
    return toFlight(created);
  }

  async update(id: string, input: UpdateFlightRequest, actor: RequestUser): Promise<Flight> {
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

  async deactivate(id: string, actor: RequestUser): Promise<Flight> {
    const updated = await this.auditService.auditedTransaction(
      this.prisma,
      { userId: actor.id, ipAddress: null, userAgent: null },
      async (tx) => {
        const existing = await tx.flight.findUnique({ where: { id } });
        if (!existing) throw new NotFoundError('Flight not found');
        return tx.flight.update({
          where: { id },
          data: { isActive: false },
          include: FLIGHT_WITH_AIRLINE_INCLUDE,
        });
      },
    );
    return toFlight(updated);
  }
}
