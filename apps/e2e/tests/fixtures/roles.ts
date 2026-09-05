import { test as base, expect, type Page } from '@playwright/test';

interface RoleFixtures {
  executivePage: Page;
  managerPage: Page;
  directorPage: Page;
  /**
   * The Manager's access token, for fixture setup (createMasterDataFixture)
   * that needs to call the API directly rather than through the UI. Reuses
   * `managerPage`'s own login response instead of a second, independent
   * `/auth/login` call — see `loginAs`'s doc comment for why this run can't
   * spare a 4th throttled request.
   */
  managerAccessToken: string;
}

const DEV_PASSWORD = 'DevPassword123!';

/**
 * One browser context per role, logged in live exactly once per worker and
 * reused for the rest of the run — lets a single spec drive a real
 * cross-role workflow (Executive creates, Manager approves, Director
 * views) the way ARCHITECTURE.md §18's "critical flows across all three
 * roles" actually means, rather than three independently-authenticated,
 * unconnected specs.
 *
 * Deliberately a *live* UI login here, not a saved `storageState` restored
 * into a fresh context — restoring only the refresh cookie leaves the
 * in-memory access token empty, so the very next page load re-triggers
 * AuthBootstrap's GET /me (401) -> POST /auth/refresh cycle
 * (providers.tsx). `/auth/refresh` shares AuthController's tight 5-req/60s
 * throttle with `/auth/login` (ARCHITECTURE §24: "aggressive on auth",
 * deliberate) — three such cold restores plus their three logins is 6
 * throttled requests inside a few seconds, one over budget, and reliably
 * 429'd whichever role went third. A real login already populates the
 * store directly from the login response (LoginPage's onSuccess) with no
 * follow-up /me or /refresh call at all, so logging in three times costs
 * exactly 3 throttled requests for the whole run — as long as specs use
 * client-side navigation (clicking links/buttons) afterwards rather than
 * `page.goto()`/`page.reload()`, which force a full reload and would
 * re-trigger the same cold-start refresh cycle. `managerAccessToken` piggy-
 * backs on the Manager login response instead of a 4th independent login.
 */
async function loginAs(page: Page, email: string): Promise<string> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(DEV_PASSWORD);
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith('/auth/login') && res.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Sign in' }).click(),
  ]);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

export const test = base.extend<object, RoleFixtures>({
  executivePage: [
    async ({ browser }, use) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await loginAs(page, 'executive@hublanka.dev');
      await use(page);
      await context.close();
    },
    { scope: 'worker' },
  ],
  managerPage: [
    async ({ browser }, use) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const token = await loginAs(page, 'manager@hublanka.dev');
      managerLoginToken = token;
      await use(page);
      await context.close();
    },
    { scope: 'worker' },
  ],
  // Declared with `managerPage` as its own dependency argument, so
  // Playwright always initializes `managerPage` (and thus its one login)
  // first, guaranteeing `managerLoginToken` is already set below.
  managerAccessToken: [
    async ({ managerPage: _managerPage }, use) => {
      await use(managerLoginToken);
    },
    { scope: 'worker' },
  ],
  directorPage: [
    async ({ browser }, use) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await loginAs(page, 'director@hublanka.dev');
      await use(page);
      await context.close();
    },
    { scope: 'worker' },
  ],
});

let managerLoginToken = '';

export { expect } from '@playwright/test';
