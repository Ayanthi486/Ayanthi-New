import { describe, expect, it } from 'vitest';
import { healthCheckResponseSchema } from './health';

describe('healthCheckResponseSchema', () => {
  it('accepts a healthy response', () => {
    const result = healthCheckResponseSchema.safeParse({
      status: 'ok',
      info: { database: { status: 'up' } },
      details: { database: { status: 'up' } },
    });

    expect(result.success).toBe(true);
  });

  it('rejects an unknown status value', () => {
    const result = healthCheckResponseSchema.safeParse({ status: 'unknown' });

    expect(result.success).toBe(false);
  });
});
