const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)$/;
const UNIT_MS: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** Parses env-style duration strings ("15m", "7d") used for JWT_*_EXPIRES_IN. */
export function parseDurationToMs(value: string): number {
  const match = DURATION_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration string: "${value}"`);
  }
  const [, amount, unit] = match;
  const unitMs = UNIT_MS[unit as string];
  if (amount === undefined || unitMs === undefined) {
    throw new Error(`Invalid duration string: "${value}"`);
  }
  return Number(amount) * unitMs;
}
