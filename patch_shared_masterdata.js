const fs = require('fs');
let file = fs.readFileSync('packages/shared/src/masterdata.ts', 'utf8');

file = file.replace(
  `export type CreateAirportRequest = z.infer<typeof createAirportRequestSchema>;`,
  `export type CreateAirportRequest = z.infer<typeof createAirportRequestSchema>;

export const updateAirportRequestSchema = createAirportRequestSchema;
export type UpdateAirportRequest = z.infer<typeof updateAirportRequestSchema>;`
);

file = file.replace(
  `export type CreateFlightRequest = z.infer<typeof createFlightRequestSchema>;`,
  `export type CreateFlightRequest = z.infer<typeof createFlightRequestSchema>;

export const updateFlightRequestSchema = createFlightRequestSchema;
export type UpdateFlightRequest = z.infer<typeof updateFlightRequestSchema>;`
);

file = file.replace(
  `export type CreateCommodityRequest = z.infer<typeof createCommodityRequestSchema>;`,
  `export type CreateCommodityRequest = z.infer<typeof createCommodityRequestSchema>;

export const updateCommodityRequestSchema = createCommodityRequestSchema;
export type UpdateCommodityRequest = z.infer<typeof updateCommodityRequestSchema>;`
);

fs.writeFileSync('packages/shared/src/masterdata.ts', file);
