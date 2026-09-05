import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: './',
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    globals: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    // e2e specs share one real Postgres instance/connection pool and
    // mutate common state (lockout counters, throttle windows, the audit
    // AsyncLocalStorage context) — run files sequentially, not in parallel
    // workers, so they can't interfere with each other.
    fileParallelism: false,
  },
});
