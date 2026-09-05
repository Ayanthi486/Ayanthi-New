// Asia/Colombo is a fixed UTC+5:30 offset, no DST — same convention as the
// backend's shipment.util.ts#COLOMBO_OFFSET_MS.
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** `flightDate` ('YYYY-MM-DD') + `depTime` ('HH:MM'), both Colombo wall-clock, to the true UTC instant. */
export function scheduledDepartureInstant(flightDate: string, depTime: string): Date {
  const colomboWallClockAsUtc = new Date(`${flightDate}T${depTime}:00.000Z`);
  return new Date(colomboWallClockAsUtc.getTime() - COLOMBO_OFFSET_MS);
}

/** e.g. "3h 42m" / "12m" — never negative; callers decide the "in"/"ago" framing. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(Math.abs(ms) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** "Departs in 3h 42m" before scheduled departure, "Departure was 1h 5m ago" after — BR-50: still shown past scheduled time until actual departure is recorded. */
export function formatCountdown(scheduledDeparture: Date, now: Date): string {
  const diffMs = scheduledDeparture.getTime() - now.getTime();
  return diffMs >= 0
    ? `Departs in ${formatDuration(diffMs)}`
    : `Departure was ${formatDuration(diffMs)} ago`;
}
