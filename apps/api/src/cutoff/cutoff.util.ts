import type { CutoffAlert as SharedCutoffAlert, CutoffState } from '@hub-lanka/shared';
import { COLOMBO_OFFSET_MS } from '../shipment/shipment.util';

export interface CutoffThresholds {
  /** BR-21: confirmed 5 hours, still configurable per DEVELOPMENT_PLAN.md. */
  approachingHours: number;
  /** No confirmed value anywhere in PRD/CONTEXT — inferred, configurable (Phase 8 report). */
  urgentHours: number;
}

export interface CutoffShipment {
  flightDate: Date;
  depTime: Date;
  actualDepartureAt: Date | null;
}

/**
 * `flightDate` (@db.Date) and `depTime` (@db.Time) are each stored as plain
 * wall-clock values with no timezone semantics of their own — same
 * convention `shipment.util.ts`'s `colomboToday()` already establishes.
 * Combined, they represent a moment in Asia/Colombo local time; subtracting
 * the fixed offset converts that to the true UTC instant this function
 * (and everything downstream) compares against `now`.
 */
export function combineFlightDateAndDepTime(flightDate: Date, depTime: Date): Date {
  const dateOnly = flightDate.toISOString().slice(0, 10);
  const timeOnly = depTime.toISOString().slice(11, 16);
  const colomboWallClockAsUtc = new Date(`${dateOnly}T${timeOnly}:00.000Z`);
  return new Date(colomboWallClockAsUtc.getTime() - COLOMBO_OFFSET_MS);
}

/**
 * PRD §5.5/CONTEXT.md §18's state machine (Phase 8 decision #3). Returns
 * `null` for Normal — decision #1: no `cutoff_alert` row is the Normal
 * state, so the caller upserts a row only when this returns non-null.
 * `URGENT` is not time-bounded on the far end: a shipment past its
 * scheduled departure with no `actualDepartureAt` recorded stays `URGENT`
 * indefinitely (BR-50 — the warning "ends at actual flight departure," not
 * at any elapsed-time cutoff, and not at Completed status either).
 */
export function computeCutoffState(
  shipment: CutoffShipment,
  now: Date,
  thresholds: CutoffThresholds,
): CutoffState | null {
  if (shipment.actualDepartureAt !== null) return 'PASSED';

  const scheduledDeparture = combineFlightDateAndDepTime(shipment.flightDate, shipment.depTime);
  const hoursUntilDeparture = (scheduledDeparture.getTime() - now.getTime()) / (60 * 60 * 1000);

  if (hoursUntilDeparture > thresholds.approachingHours) return null;
  if (hoursUntilDeparture > thresholds.urgentHours) return 'APPROACHING';
  return 'URGENT';
}

/** Escalation order — used to decide whether a state change clears an existing acknowledgement (decision #2). */
const SEVERITY: Record<CutoffState, number> = { APPROACHING: 1, URGENT: 2, PASSED: 3 };

export function isMoreSevere(next: CutoffState, previous: CutoffState): boolean {
  return SEVERITY[next] > SEVERITY[previous];
}

export interface CutoffAlertRow {
  id: string;
  shipmentId: string;
  state: CutoffState;
  raisedAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedByUserId: string | null;
  resolvedAt: Date | null;
}

export function toSharedCutoffAlert(row: CutoffAlertRow): SharedCutoffAlert {
  return {
    id: row.id,
    shipmentId: row.shipmentId,
    state: row.state,
    raisedAt: row.raisedAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt ? row.acknowledgedAt.toISOString() : null,
    acknowledgedByUserId: row.acknowledgedByUserId,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  };
}
