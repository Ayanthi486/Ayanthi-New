import { describe, expect, it } from 'vitest';
import { parseDurationToMs } from './duration.util';

describe('parseDurationToMs', () => {
  it('parses minutes', () => {
    expect(parseDurationToMs('15m')).toBe(15 * 60_000);
  });

  it('parses days', () => {
    expect(parseDurationToMs('7d')).toBe(7 * 86_400_000);
  });

  it('parses seconds and hours', () => {
    expect(parseDurationToMs('30s')).toBe(30_000);
    expect(parseDurationToMs('2h')).toBe(2 * 3_600_000);
  });

  it('rejects an unrecognized format', () => {
    expect(() => parseDurationToMs('nonsense')).toThrow(/Invalid duration string/);
    expect(() => parseDurationToMs('5x')).toThrow(/Invalid duration string/);
  });
});
