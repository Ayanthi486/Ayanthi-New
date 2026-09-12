import { describe, expect, it } from 'vitest';
import {
  addDays,
  colomboToday,
  computeCutoffTime,
  parseDateOnly,
  parseTime24,
  toSharedShipment,
  type ShipmentRow,
} from './shipment.util';

describe('shipment.util', () => {
  describe('colomboToday / addDays', () => {
    it('returns a YYYY-MM-DD string', () => {
      expect(colomboToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('addDays advances the calendar date, including across a month boundary', () => {
      expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
      expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });
  });

  describe('computeCutoffTime', () => {
    it('subtracts Delay Hours from Dep Time (e.g. 20:00 - 05:00 = 15:00)', () => {
      const depTime = new Date('1970-01-01T20:00:00.000Z');
      const delayHours = new Date('1970-01-01T05:00:00.000Z');
      expect(computeCutoffTime(depTime, delayHours)).toBe('15:00');
    });

    it('wraps across midnight like a clock, rather than going negative', () => {
      const depTime = new Date('1970-01-01T02:00:00.000Z');
      const delayHours = new Date('1970-01-01T05:00:00.000Z');
      expect(computeCutoffTime(depTime, delayHours)).toBe('21:00');
    });
  });

  describe('parseDateOnly / parseTime24', () => {
    it('parses a date-only string to UTC midnight', () => {
      const date = parseDateOnly('2026-06-15');
      expect(date.toISOString()).toBe('2026-06-15T00:00:00.000Z');
    });

    it('parses a 24-hour time string on the 1970-01-01 epoch date', () => {
      const time = parseTime24('03:05');
      expect(time.toISOString()).toBe('1970-01-01T03:05:00.000Z');
    });
  });

  describe('toSharedShipment', () => {
    const baseRow: ShipmentRow = {
      id: 'shipment-1',
      shipmentNo: 'HUB 000001',
      mawbNo: '176 2853 0191',
      houseAwbNo: 'HL 0106',
      airlineId: 'airline-1',
      airline: { code: 'EK', name: 'Emirates' },
      flightNo: 'EK654',
      destinationAirportId: 'airport-1',
      destinationAirport: { code: 'DXB' },
      shipperId: 'shipper-1',
      shipper: { name: 'Acme Exports', address: '123 Export Way', contact: '+94 11 234 5678' },
      consigneeId: 'consignee-1',
      consignee: { name: 'Acme Imports', address: '456 Import Ave', contact: null },
      commodityId: 'commodity-1',
      commodity: { name: 'Edible Fish', delayHours: new Date('1970-01-01T05:00:00.000Z') },
      serviceType: 'BOOKING_AND_HANDLING',
      flightDate: new Date('2026-06-15T00:00:00.000Z'),
      handlingDate: new Date('2026-06-14T00:00:00.000Z'),
      depTime: new Date('1970-01-01T03:05:00.000Z'),
      cusdecNo: 'CUS-12345',
      boxCount: 10,
      weightKg: { toString: () => '444.500' },
      appliedBuyingRate: { toString: () => '4.7500' },
      appliedBuyingRateId: 'rate-1',
      actualDepartureAt: null,
      status: 'PENDING',
      version: 0,
      createdByUserId: 'user-1',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T00:00:00.000Z'),
    };

    it('formats date/time fields as wire-friendly strings, not Date objects', () => {
      const shared = toSharedShipment(baseRow);
      expect(shared.flightDate).toBe('2026-06-15');
      expect(shared.handlingDate).toBe('2026-06-14');
      expect(shared.depTime).toBe('03:05');
      // Dep Time 03:05 - Commodity Delay Hours 05:00, wrapping past midnight.
      expect(shared.cutoffTime).toBe('22:05');
      expect(shared.weightKg).toBe('444.500');
      expect(shared.appliedBuyingRate).toBe('4.7500');
    });

    it('denormalizes master-data names from the included relations', () => {
      const shared = toSharedShipment(baseRow);
      expect(shared.airlineCode).toBe('EK');
      expect(shared.airlineName).toBe('Emirates');
      expect(shared.shipperName).toBe('Acme Exports');
      expect(shared.shipperAddress).toBe('123 Export Way');
      expect(shared.shipperContact).toBe('+94 11 234 5678');
      expect(shared.consigneeName).toBe('Acme Imports');
      expect(shared.consigneeAddress).toBe('456 Import Ave');
      expect(shared.consigneeContact).toBeNull();
      expect(shared.commodityName).toBe('Edible Fish');
      expect(shared.serviceType).toBe('BOOKING_AND_HANDLING');
      expect(shared.destinationAirportCode).toBe('DXB');
    });

    it('leaves null-able fields null rather than coercing them', () => {
      const shared = toSharedShipment({
        ...baseRow,
        handlingDate: null,
        weightKg: null,
        boxCount: null,
        destinationAirportId: null,
        destinationAirport: null,
        appliedBuyingRate: null,
        appliedBuyingRateId: null,
      });
      expect(shared.handlingDate).toBeNull();
      expect(shared.weightKg).toBeNull();
      expect(shared.boxCount).toBeNull();
      expect(shared.destinationAirportCode).toBeNull();
      expect(shared.appliedBuyingRate).toBeNull();
    });
  });
});
