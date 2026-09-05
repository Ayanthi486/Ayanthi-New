import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.validation';

/**
 * Pure lockout-window computation (ARCHITECTURE §8: "Account lockout after
 * repeated failures"). Deliberately has no database access — AuthService
 * reads/writes User.failedLoginCount/lockedUntil; this just computes the
 * next values, which keeps it trivially unit-testable.
 */
@Injectable()
export class LockoutService {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  isLocked(user: { lockedUntil: Date | null }): boolean {
    return user.lockedUntil !== null && user.lockedUntil > new Date();
  }

  computeAfterFailure(user: { failedLoginCount: number }): {
    failedLoginCount: number;
    lockedUntil: Date | null;
  } {
    const maxAttempts = this.config.get('LOGIN_LOCKOUT_MAX_ATTEMPTS', { infer: true });
    const durationMinutes = this.config.get('LOGIN_LOCKOUT_DURATION_MINUTES', { infer: true });
    const failedLoginCount = user.failedLoginCount + 1;

    return {
      failedLoginCount,
      lockedUntil:
        failedLoginCount >= maxAttempts ? new Date(Date.now() + durationMinutes * 60_000) : null,
    };
  }

  computeAfterSuccess(): { failedLoginCount: number; lockedUntil: null } {
    return { failedLoginCount: 0, lockedUntil: null };
  }
}
