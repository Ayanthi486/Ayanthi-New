import type { Page } from '@playwright/test';
import { createMasterDataFixture, type MasterDataFixture } from './fixtures/api-client';
import { openShipment, widenScheduleDateFilter } from './fixtures/nav';
import { expect, test } from './fixtures/roles';

/**
 * ARCHITECTURE.md §18 / DEVELOPMENT_PLAN.md Phase 10: the critical path
 * through a real browser, across all three roles, against the real running
 * stack — create (Executive) -> cargo handling (Executive) -> buying rate
 * (Manager) -> Cost Sheet release/approve (Executive/Manager) -> Invoice
 * create/issue (Manager) -> payment to fully paid (Manager) -> a document
 * issued (Executive) -> completion approval (Manager) -> Director's
 * read-only view of the finished record. Each `test` shares `shipmentNo`
 * via the enclosing `describe.serial` — a later step genuinely depends on
 * an earlier one having actually happened in the browser, not a fixture.
 * Navigation between steps goes through `openShipment` (client-side,
 * search-box + "View" link) rather than `page.goto()` — see fixtures/roles.ts
 * for why a full reload here is expensive against the real auth throttle.
 */
test.describe.serial('Shipment lifecycle — critical path across all three roles', () => {
  let masterData: MasterDataFixture;
  let shipmentNo: string;
  const today = new Date();
  const isoDate = (offsetDays: number): string => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };

  test.beforeAll(async ({ managerAccessToken }) => {
    masterData = await createMasterDataFixture(managerAccessToken);
  });

  /** MasterDataCombobox: click the search input, type to filter, click the match. */
  async function selectFromCombobox(
    page: Page,
    label: string,
    query: string,
    optionName: string | RegExp,
  ) {
    const input = page.getByLabel(label, { exact: true });
    await input.click();
    await input.fill(query);
    await page.getByRole('option', { name: optionName }).click();
  }

  test('Executive creates a shipment', async ({ executivePage: page }) => {
    await page.getByRole('link', { name: 'Shipments', exact: true }).click();
    await page.getByRole('button', { name: 'Add shipment' }).click();

    await page.getByLabel('DEP TIME').fill('23:30');
    await page.getByLabel('MAWB NO').fill(`MAWB-${Date.now()}`);
    await selectFromCombobox(
      page,
      'DEST',
      masterData.airportName,
      new RegExp(masterData.airportCode),
    );
    await selectFromCombobox(page, 'Airline', masterData.airlineName, masterData.airlineName);
    await page.getByLabel('Flight No').fill('QR0999');
    await page.getByLabel('DATE').fill(isoDate(0));
    await selectFromCombobox(page, 'SHIPPER', masterData.shipperName, masterData.shipperName);
    await selectFromCombobox(page, 'CONSIGNEE', masterData.consigneeName, masterData.consigneeName);
    await selectFromCombobox(page, 'COMMODITY', masterData.commodityName, masterData.commodityName);
    await page.getByRole('button', { name: 'Create shipment' }).click();

    // BR-15's today+tomorrow default is computed server-side in
    // Asia/Colombo, which can disagree by a day with this runner's local
    // "today" — an explicit wide range removes the ambiguity.
    await widenScheduleDateFilter(page);

    const row = page.locator('tr', { hasText: masterData.consigneeName });
    await expect(row).toBeVisible();
    await row.getByRole('link', { name: 'View' }).click();

    await expect(page.getByText('PENDING', { exact: true })).toBeVisible();
    shipmentNo = (await page
      .getByText('Shipment ID', { exact: true })
      .locator('xpath=following-sibling::div[1]')
      .textContent())!.trim();
    expect(shipmentNo).toMatch(/^HUB \d{6}$/);
  });

  test('Executive enters BOX and WEIGHT (cargo handling, BR-06)', async ({
    executivePage: page,
  }) => {
    await openShipment(page, shipmentNo);
    await page.getByLabel('Box count').fill('26');
    await page.getByLabel('Weight (kg)').fill('444.500');
    await page.getByRole('button', { name: 'Save' }).click();
    // Decimal(10,3)'s stored value round-trips through the API without
    // padding trailing zeros (Prisma.Decimal#toString), so "444.500" as
    // entered displays back as "444.5".
    await expect(page.getByText('444.5', { exact: true })).toBeVisible();
  });

  test('Manager captures the airline buying rate (BR-43/BR-44)', async ({ managerPage: page }) => {
    await openShipment(page, shipmentNo);
    await expect(page.getByText('Not yet captured')).toBeVisible();
    await page.getByRole('button', { name: 'Capture current rate' }).click();
    await expect(page.getByText('4.75 USD/kg')).toBeVisible();
  });

  test('Executive prepares and releases the Cost Sheet (BR-59)', async ({
    executivePage: page,
  }) => {
    await openShipment(page, shipmentNo);
    await page.getByRole('button', { name: 'Create Cost Sheet' }).click();
    await expect(page.getByText('DRAFT', { exact: true })).toBeVisible();

    await page.getByLabel('Transport').fill('1000.00');
    await page.getByLabel('Labour').fill('500.00');
    // .last(): CargoSection (earlier in the page, still visible while
    // Pending) has its own form-scoped "Save" button — this Cost Sheet
    // section's is the one that comes after it in document order.
    await page.getByRole('button', { name: 'Save' }).last().click();
    await expect(page.getByText('Total: LKR 1500.00')).toBeVisible();

    await page.getByRole('button', { name: 'Release' }).click();
    await expect(page.getByText('RELEASED', { exact: true })).toBeVisible();
  });

  test('Manager approves the Cost Sheet with a recorded signature (BR-61/AC-15)', async ({
    managerPage: page,
  }) => {
    await openShipment(page, shipmentNo);
    await expect(page.getByText('RELEASED', { exact: true })).toBeVisible();

    await page.getByLabel('Shift Leader signature').fill('U. Perera');
    await page.getByRole('button', { name: 'Save' }).last().click();
    await page.getByRole('button', { name: 'Approve' }).click();

    await expect(page.getByText('APPROVED', { exact: true })).toBeVisible();
    await expect(page.getByText(/^Approved /)).toBeVisible();
  });

  test('Manager creates, fills and issues the Invoice (BR-52/53, AC-13 machinery)', async ({
    managerPage: page,
  }) => {
    await openShipment(page, shipmentNo);
    await page.getByRole('button', { name: 'Create Invoice' }).click();
    await expect(page.getByText('DRAFT', { exact: true }).last()).toBeVisible();

    await page.getByLabel('Invoice No').fill('HUB/E2E/0001');
    await page.getByLabel('Invoice Date').fill(isoDate(0));
    await page.getByLabel('Term (days)').fill('5');
    await page.getByLabel('AWB Ex-Rate').fill('340.50');
    await page.getByLabel('Chargeable Wt').fill('500.00');

    await page.getByRole('button', { name: 'Add line' }).click();
    await page.getByLabel('Description').fill('FREIGHT CHARGES');
    await page.getByLabel('Rate (USD)').fill('100.00');
    await page.getByRole('button', { name: 'Save' }).last().click();

    // BR-41/66: Freight-only airline buying cost, computed from the
    // shipment's stored applied rate (4.75) x this invoice's Chargeable
    // Weight (500.00) = 2375.00 — independent of the FLAT charge line above.
    await expect(page.getByText('USD 2375.00')).toBeVisible();

    await page.getByRole('button', { name: 'Issue' }).click();
    await expect(page.getByText('ISSUED', { exact: true })).toBeVisible();
  });

  test('Manager records a full payment (BR-54/57, AC-16/AC-17)', async ({ managerPage: page }) => {
    await openShipment(page, shipmentNo);
    await expect(page.getByText('PARTIALLY PAID')).toBeVisible();

    await page.getByLabel('Amount').fill('100.00');
    await page.getByLabel('Payment Date').fill(isoDate(0));
    await page.getByLabel('Method').fill('Bank transfer');
    await page.getByRole('button', { name: 'Record Payment' }).click();

    await expect(page.getByText('FULLY PAID')).toBeVisible();

    // AC-17: full payment does not itself change the shipment's own status.
    await expect(page.getByText('PENDING', { exact: true })).toBeVisible();
  });

  test('Executive issues the AWB Sticker document (Phase 7 build order item 1, BR-62)', async ({
    executivePage: page,
  }) => {
    await openShipment(page, shipmentNo);
    await page.getByRole('button', { name: 'AWB Sticker' }).click();
    await page.getByRole('button', { name: 'Create AWB Sticker' }).click();
    await expect(page.getByText('DRAFT · v1')).toBeVisible();

    await page.getByRole('button', { name: 'Issue' }).click();
    await expect(page.getByText('ISSUED · v1')).toBeVisible();
  });

  test('Manager approves completion — the shipment locks (BR-09/BR-10)', async ({
    managerPage: page,
  }) => {
    await openShipment(page, shipmentNo);
    await page.getByRole('button', { name: 'Mark completed' }).click();
    await expect(page.getByText('COMPLETED', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/locked/i)).toBeVisible();
  });

  test('Director sees the finished record read-only (PRD §4)', async ({ directorPage: page }) => {
    await openShipment(page, shipmentNo);
    await expect(page.getByText('COMPLETED', { exact: true }).first()).toBeVisible();

    // Director has no edit/delete/completion-approval permission — the
    // corresponding buttons must not render at all (RequirePermission is
    // presentation-only convenience; the server independently enforces this
    // — apps/api/test/shipment.e2e-spec.ts's permission-denied tests are the
    // authoritative proof of that, this just confirms the UI matches it).
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mark completed' })).toHaveCount(0);

    // But Director does hold invoice.view.readonly — the Invoice section
    // (and its total) is visible, not hidden.
    await expect(page.getByText('ISSUED', { exact: true }).first()).toBeVisible();
  });
});
