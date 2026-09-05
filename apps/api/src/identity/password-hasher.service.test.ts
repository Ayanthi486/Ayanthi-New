import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import type { EnvConfig } from '../config/env.validation';
import { PasswordHasherService } from './password-hasher.service';

function fakeConfig(): ConfigService<EnvConfig, true> {
  const values: Partial<EnvConfig> = {
    ARGON2_MEMORY_COST: 8192,
    ARGON2_TIME_COST: 1,
    ARGON2_PARALLELISM: 1,
  };
  return { get: (key: keyof EnvConfig) => values[key] } as unknown as ConfigService<
    EnvConfig,
    true
  >;
}

describe('PasswordHasherService', () => {
  const service = new PasswordHasherService(fakeConfig());

  it('hashes as an argon2id digest', async () => {
    const hash = await service.hash('correct horse battery staple');
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('verifies a matching password', async () => {
    const hash = await service.hash('correct horse battery staple');
    await expect(service.verify(hash, 'correct horse battery staple')).resolves.toBe(true);
  });

  it('rejects a non-matching password', async () => {
    const hash = await service.hash('correct horse battery staple');
    await expect(service.verify(hash, 'wrong password')).resolves.toBe(false);
  });
});
