import { apiBaseUrl } from '../../playwright.config';

/**
 * Direct HTTP calls against the real API (not the browser) to seed the
 * master data (shipper/consignee/airline/commodity + a Rate Table entry) a
 * critical-path spec's shipment needs to exist before the *browser* can
 * select it from a dropdown. Creating this data is well-covered CRUD
 * (component + api-integration tests) in its own right — re-driving it
 * through the UI here would only slow the spec down without testing
 * anything this suite doesn't already cover elsewhere.
 *
 * Takes the Manager's access token as a parameter (from the
 * `managerAccessToken` fixture, roles.ts) rather than logging in itself —
 * every additional `/auth/login` call competes for the same tight 5-req/60s
 * throttle the browser-driven logins already need in full (see roles.ts).
 */
export interface MasterDataFixture {
  airlineId: string;
  airlineName: string;
  shipperId: string;
  shipperName: string;
  consigneeId: string;
  consigneeName: string;
  commodityId: string;
  commodityName: string;
  airportCode: string;
  airportName: string;
}

async function post<T>(path: string, token: string, data: unknown): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/** Fresh, uniquely-named master data so a re-run never collides with a prior run's rows. */
export async function createMasterDataFixture(managerToken: string): Promise<MasterDataFixture> {
  const runId = Date.now();

  const airline = await post<{ id: string; name: string }>('/masterdata/airlines', managerToken, {
    name: `E2E Airline ${runId}`,
  });
  const shipper = await post<{ id: string; name: string }>('/masterdata/shippers', managerToken, {
    name: `E2E Shipper ${runId}`,
    address: '419 3/1, Galle Road, Colombo 03',
  });
  const consignee = await post<{ id: string; name: string }>(
    '/masterdata/consignees',
    managerToken,
    { name: `E2E Consignee ${runId}`, address: '1 Test Street, Milan, Italy' },
  );
  const commodity = await post<{ id: string; name: string }>(
    '/masterdata/commodities',
    managerToken,
    { name: `E2E Commodity ${runId}` },
  );
  // The New Shipment form's DEST field needs a destination airport — code
  // must be short/unique-ish; last 3 digits of runId keep re-runs distinct.
  const airport = await post<{ id: string; code: string; name: string }>(
    '/masterdata/airports',
    managerToken,
    { code: `X${String(runId).slice(-2)}`, name: `E2E Airport ${runId}` },
  );
  // BR-45: the buying rate is resolved by effective date — must already be
  // in effect (not future-dated) for BuyingRateSection's capture to resolve one.
  await post('/rates', managerToken, {
    airlineId: airline.id,
    rateUsdPerKg: '4.75',
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });

  return {
    airlineId: airline.id,
    airlineName: airline.name,
    shipperId: shipper.id,
    shipperName: shipper.name,
    consigneeId: consignee.id,
    consigneeName: consignee.name,
    commodityId: commodity.id,
    commodityName: commodity.name,
    airportCode: airport.code,
    airportName: airport.name,
  };
}
