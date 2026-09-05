import { expect, test } from './fixtures/roles';

/**
 * PRD §4's permission matrix, spot-checked through the real browser
 * (server-side enforcement is separately proven by
 * apps/api/test/permissions.e2e-spec.ts and every module's own
 * permission-denied e2e tests — this file confirms the UI's presentation
 * layer actually matches those permissions, not the other way around).
 * Self-contained: no shipment or other fixture data needed, just each
 * role's own navigation after login — deliberately no `page.goto()` here
 * (fixtures/roles.ts's live login already lands each role's page on `/`,
 * and a `goto()`/reload only costs another throttled auth request for no
 * benefit).
 */
test.describe('Role-conditional navigation (RequirePermission is presentation, not access control)', () => {
  test('Executive sees Shipments but not Master Data, Rate Table or Users', async ({
    executivePage: page,
  }) => {
    await expect(page.getByRole('link', { name: 'Shipments', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Master Data' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Rate Table' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
  });

  test('Manager sees Shipments, Master Data, Rate Table, Analytics and Users', async ({
    managerPage: page,
  }) => {
    await expect(page.getByRole('link', { name: 'Shipments', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Master Data' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Rate Table' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Analytics' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
  });

  test('Director sees Shipments and Analytics but not Master Data, Rate Table or Users', async ({
    directorPage: page,
  }) => {
    await expect(page.getByRole('link', { name: 'Shipments', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Analytics' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Master Data' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Rate Table' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
  });

  test('An unauthenticated visitor is redirected to /login', async ({ browser }) => {
    // Deliberately no storageState — a fresh, fully logged-out context.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/shipments');
    await expect(page).toHaveURL(/\/login$/);
    await context.close();
  });
});
