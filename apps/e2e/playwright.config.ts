import { defineConfig, devices } from '@playwright/test';

/**
 * ARCHITECTURE.md §18 / DEVELOPMENT_PLAN.md Phase 10: "critical flows across
 * all three roles," a real browser against the real running stack — not a
 * mock. This config does not start the stack itself (docker-compose.yml, or
 * `pnpm dev` + a local api/worker/postgres/redis, already does that);
 * defaults match docker-compose.yml's published ports so `docker compose up`
 * followed by `pnpm --filter @hub-lanka/e2e test` works with no extra setup.
 *
 * One project (not one-project-per-role, no separate "setup" project):
 * several specs — most importantly the shipment lifecycle — genuinely need
 * Executive, Manager and Director acting on the *same* record within one
 * test (create as Executive, approve as Manager, view as Director).
 * `tests/fixtures/roles.ts` hands each spec a
 * `{ executivePage, managerPage, directorPage }` fixture, each its own
 * browser context logged in live once per worker (see that file for why a
 * saved `storageState` restored into a fresh context isn't used instead —
 * short version: it silently doubles the number of requests against
 * AuthController's login/refresh throttle).
 */
const webBaseUrl = process.env.PLAYWRIGHT_WEB_BASE_URL ?? 'http://localhost:4173';
export const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  // Every spec shares one Postgres instance and mutates common state
  // (rate table, shipment sequence) — one worker only, same reasoning as
  // the api e2e suite's `fileParallelism: false`.
  workers: 1,
  // 2, not 0: apps/web/Dockerfile's own comment flags `vite preview` as a
  // dev/staging stand-in ("a production deployment fronts this with
  // Nginx/Caddy... out of scope for Phase 0") — it intermittently drops
  // connections (net::ERR_CONNECTION_RESET) under this suite's real
  // browser load. Standard Playwright CI practice for exactly this kind of
  // transient infra flake, not a way to mask a real app failure — a
  // genuine assertion failure still fails the retry too.
  retries: 2,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: webBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
