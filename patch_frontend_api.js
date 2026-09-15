const fs = require('fs');

let apiFile = fs.readFileSync('apps/web/src/features/masterdata/api/masterdataApi.ts', 'utf8');

apiFile = apiFile.replace(
  `import type {
  Airline,
  Airport,
  Commodity,
  Consignee,
  CreateAirlineRequest,
  CreateAirportRequest,
  CreateCommodityRequest,
  CreateConsigneeRequest,
  CreateFlightRequest,
  CreateShipperRequest,
  Flight,
  Shipper,
} from '@hub-lanka/shared';`,
  `import type {
  Airline,
  Airport,
  Commodity,
  Consignee,
  CreateAirlineRequest,
  CreateAirportRequest,
  CreateCommodityRequest,
  CreateConsigneeRequest,
  CreateFlightRequest,
  CreateShipperRequest,
  Flight,
  Shipper,
  UpdateAirportRequest,
  UpdateCommodityRequest,
  UpdateFlightRequest,
} from '@hub-lanka/shared';`
);

apiFile += `
export async function updateAirport(id: string, input: UpdateAirportRequest): Promise<Airport> {
  return apiFetch(\`/masterdata/airports/\${id}\`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function updateCommodity(id: string, input: UpdateCommodityRequest): Promise<Commodity> {
  return apiFetch(\`/masterdata/commodities/\${id}\`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function updateFlight(id: string, input: UpdateFlightRequest): Promise<Flight> {
  return apiFetch(\`/masterdata/flights/\${id}\`, { method: 'PATCH', body: JSON.stringify(input) });
}
`;

fs.writeFileSync('apps/web/src/features/masterdata/api/masterdataApi.ts', apiFile);
