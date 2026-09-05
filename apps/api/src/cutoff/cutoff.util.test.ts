import { describe, expect, it } from 'vitest';
import {
  combineFlightDateAndDepTime,
  computeCutoffState,
  isMoreSevere,
  toSharedCutoffAlert,
  type CutoffAlertRow,
} from './cutoff.util';

const THRESHOLDS = { approachingHours: 5, urgentHours: 1 };

/** 2026-08-04 14:00 Colombo (UTC+5:30) = 2026-08-04T08:30:00.000Z. */
const FLIGHT_DATE = new Date('2026-08-04T00:00:00.000Z');
const DEP_TIME = new Date('1970-01-01T14:00:00.000Z');

describe('cutoff.util', () => {
  describe('combineFlightDateAndDepTime', () => {
    it('converts the Colombo wall-clock flightDate+depTime into the true UTC instant', () => {
      const instant = combineFlightDateAndDepTime(FLIGHT_DATE, DEP_TIME);
      expect(instant.toISOString()).toBe('2026-08-04T08:30:00.000Z');
    });
  });

  describe('computeCutoffState — PRD §5.5/BR-21/BR-50', () => {
    const shipment = { flightDate: FLIGHT_DATE, depTime: DEP_TIME, actualDepartureAt: null };

    it('is Normal (null) more than 5 hours before scheduled departure', () => {
      const now = new Date('2026-08-04T03:00:00.000Z'); // 5h30m before 08:30Z
      expect(computeCutoffState(shipment, now, THRESHOLDS)).toBeNull();
    });

    it('fires Approaching at exactly the 5-hour boundary (AC-09)', () => {
      const now = new Date('2026-08-04T03:30:00.000Z'); // exactly 5h before 08:30Z
      expect(computeCutoffState(shipment, now, THRESHOLDS)).toBe('APPROACHING');
    });

    it('is Urgent inside the urgent threshold', () => {
      const now = new Date('2026-08-04T07:45:00.000Z'); // 45min before 08:30Z
      expect(computeCutoffState(shipment, now, THRESHOLDS)).toBe('URGENT');
    });

    it('stays Urgent indefinitely past scheduled departure with no actual departure recorded (BR-50)', () => {
      const now = new Date('2026-08-05T00:00:00.000Z'); // ~15.5h after scheduled departure
      expect(computeCutoffState(shipment, now, THRESHOLDS)).toBe('URGENT');
    });

    it('is Passed once actualDepartureAt is recorded, regardless of time (BR-50, not Completed status)', () => {
      const departedShipment = {
        ...shipment,
        actualDepartureAt: new Date('2026-08-04T08:35:00.000Z'),
      };
      const now = new Date('2026-08-04T03:00:00.000Z'); // even well before scheduled departure
      expect(computeCutoffState(departedShipment, now, THRESHOLDS)).toBe('PASSED');
    });
  });

  describe('isMoreSevere', () => {
    it('orders Approaching < Urgent < Passed', () => {
      expect(isMoreSevere('URGENT', 'APPROACHING')).toBe(true);
      expect(isMoreSevere('PASSED', 'URGENT')).toBe(true);
      expect(isMoreSevere('APPROACHING', 'URGENT')).toBe(false);
      expect(isMoreSevere('URGENT', 'URGENT')).toBe(false);
    });
  });

  describe('toSharedCutoffAlert', () => {
    const row: CutoffAlertRow = {
      id: 'alert-1',
      shipmentId: 'shipment-1',
      state: 'URGENT',
      raisedAt: new Date('2026-08-04T07:30:00.000Z'),
      acknowledgedAt: null,
      acknowledgedByUserId: null,
      resolvedAt: null,
    };

    it('maps timestamps to ISO strings and leaves nulls null', () => {
      const shared = toSharedCutoffAlert(row);
      expect(shared.raisedAt).toBe('2026-08-04T07:30:00.000Z');
      expect(shared.acknowledgedAt).toBeNull();
      expect(shared.resolvedAt).toBeNull();
    });
  });
});
