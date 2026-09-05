import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it } from 'vitest';
import type { EnvConfig } from '../config/env.validation';
import { LockoutService } from './lockout.service';

function fakeConfig(overrides: Partial<EnvConfig> = {}): ConfigService<EnvConfig, true> {
  const values: Partial<EnvConfig> = {
    LOGIN_LOCKOUT_MAX_ATTEMPTS: 5,
    LOGIN_LOCKOUT_DURATION_MINUTES: 15,
    ...overrides,
  };
  return { get: (key: keyof EnvConfig) => values[key] } as unknown as ConfigService<
    EnvConfig,
    true
  >;
}

describe('LockoutService', () => {
  let service: LockoutService;

  beforeEach(() => {
    service = new LockoutService(fakeConfig());
  });

  describe('isLocked', () => {
    it('is false with no lockedUntil', () => {
      expect(service.isLocked({ lockedUntil: null })).toBe(false);
    });

    it('is true while lockedUntil is in the future', () => {
      expect(service.isLocked({ lockedUntil: new Date(Date.now() + 60_000) })).toBe(true);
    });

    it('is false once lockedUntil has passed', () => {
      expect(service.isLocked({ lockedUntil: new Date(Date.now() - 60_000) })).toBe(false);
    });
  });

  describe('computeAfterFailure', () => {
    it('increments the counter without locking below the threshold', () => {
      const result = service.computeAfterFailure({ failedLoginCount: 2 });
      expect(result.failedLoginCount).toBe(3);
      expect(result.lockedUntil).toBeNull();
    });

    it('locks the account once the threshold is reached', () => {
      const result = service.computeAfterFailure({ failedLoginCount: 4 });
      expect(result.failedLoginCount).toBe(5);
      expect(result.lockedUntil).toBeInstanceOf(Date);
      expect(result.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    });

    it('respects a configured threshold', () => {
      const strict = new LockoutService(fakeConfig({ LOGIN_LOCKOUT_MAX_ATTEMPTS: 1 }));
      const result = strict.computeAfterFailure({ failedLoginCount: 0 });
      expect(result.lockedUntil).toBeInstanceOf(Date);
    });
  });

  describe('computeAfterSuccess', () => {
    it('resets the counter and clears any lock', () => {
      expect(service.computeAfterSuccess()).toEqual({ failedLoginCount: 0, lockedUntil: null });
    });
  });
});
