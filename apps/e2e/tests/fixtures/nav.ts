import type { Page } from '@playwright/test';

/**
 * Client-side (React Router `Link`/`Button` clicks) navigation helpers —
 * never `page.goto()`/`page.reload()` once a role's page is logged in. See
 * `roles.ts` for why: a full reload re-triggers AuthBootstrap's cold-start
 * refresh cycle, which shares AuthController's tight login/refresh throttle
 * and a worker-scoped run doing this on every one of this suite's ~15
 * navigations blows straight through it.
 */
export async function openSchedule(page: Page): Promise<void> {
  const scheduleLink = page.getByRole('link', { name: 'Shipments', exact: true });
  if (await scheduleLink.isVisible()) {
    await scheduleLink.click();
    return;
  }
  // Already there, or mid-navigation from a "Back to schedule" button.
  await page.getByRole('heading', { name: 'Daily Shipment Schedule' }).waitFor();
}

/** Widens the schedule's date filter well past BR-15's today+tomorrow default so a fixture shipment (any flightDate near "now") is never excluded by a Colombo/runner timezone edge case. */
export async function widenScheduleDateFilter(page: Page): Promise<void> {
  const today = new Date();
  const isoDate = (offsetDays: number): string => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };
  await page.getByLabel('From').fill(isoDate(-3));
  await page.getByLabel('To').fill(isoDate(3));
}

/** Opens a shipment's detail view by its Shipment ID, via the schedule's search box and "View" row link — never by URL. */
export async function openShipment(page: Page, shipmentNo: string): Promise<void> {
  await openSchedule(page);
  await widenScheduleDateFilter(page);
  await page.getByLabel('Search by Shipment ID').fill(shipmentNo);
  const row = page.locator('tr', { hasText: shipmentNo });
  await row.getByRole('link', { name: 'View' }).click();
}
