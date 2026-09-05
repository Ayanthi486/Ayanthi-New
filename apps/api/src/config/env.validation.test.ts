import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation';

const validBase = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  APP_DATABASE_URL: 'postgresql://app_user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults for optional keys', () => {
    const result = validateEnv(validBase);

    expect(result.NODE_ENV).toBe('development');
    expect(result.API_PORT).toBe(3000);
    expect(result.SWAGGER_ENABLED).toBe(false);
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(() => validateEnv({ ...validBase, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL: _omit, ...rest } = validBase;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('rejects a missing APP_DATABASE_URL', () => {
    const { APP_DATABASE_URL: _omit, ...rest } = validBase;
    expect(() => validateEnv(rest)).toThrow(/APP_DATABASE_URL/);
  });

  it('coerces boolean-like strings', () => {
    const result = validateEnv({ ...validBase, SWAGGER_ENABLED: 'true', LOG_PRETTY: 'false' });

    expect(result.SWAGGER_ENABLED).toBe(true);
    expect(result.LOG_PRETTY).toBe(false);
  });
});
