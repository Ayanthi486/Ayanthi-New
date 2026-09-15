const fs = require('fs');

let file = fs.readFileSync('packages/shared/src/masterdata.ts', 'utf8');

file = file.replace(
  `export const createAirlineRequestSchema = z.object({
  code: airlineCode,
  name,
});`,
  `export const createAirlineRequestSchema = z.object({
  code: airlineCode,
  name,
  awbPrefix: z.string().trim().regex(/^\\d{3}$/, 'MAWB Prefix must be exactly 3 digits').optional().nullable(),
});`
);

file = file.replace(
  `export const airlineSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});`,
  `export const airlineSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  awbPrefix: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});`
);

fs.writeFileSync('packages/shared/src/masterdata.ts', file);
