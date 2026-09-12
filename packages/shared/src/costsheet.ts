import { z } from 'zod';

/**
 * BR-59/60/61: Executive prepares, signs, and releases; Manager reviews,
 * edits, and approves. Direct request: Executive can still edit after
 * release, but loses edit access entirely once Approved — only Manager can
 * edit an Approved Cost Sheet.
 */
export const COST_SHEET_STATUSES = ['DRAFT', 'RELEASED', 'APPROVED'] as const;
export type CostSheetStatus = (typeof COST_SHEET_STATUSES)[number];

/**
 * The 11 fixed expense-line types (CONTEXT.md §12). Fixed and exhaustive —
 * there is no "add a line type" capability; every cost sheet gets exactly
 * these 11 rows.
 */
export const COST_SHEET_LINE_TYPES = [
  'SL_CUSTOMS_RECEIPTS',
  'SRILANKAN_SECURITY_CHARGES_RECEIPTS',
  'ANIMAL_QUARANTINE',
  'PLANT_QUARANTINE',
  'TRANSPORT',
  'AASL_VEHICLE_PASS',
  'LABOUR',
  'SRILANKAN_SECURITY_OFFICER_EXPENSES',
  'INSPECTION',
  'OPERATIONAL',
  'OTHER',
] as const;
export type CostSheetLineType = (typeof COST_SHEET_LINE_TYPES)[number];

/** Company layout labels — single source of truth for both the API and the frontend form. */
export const COST_SHEET_LINE_LABELS: Record<CostSheetLineType, string> = {
  SL_CUSTOMS_RECEIPTS: 'SL Customs Receipts',
  SRILANKAN_SECURITY_CHARGES_RECEIPTS: 'SriLankan Security Charges Receipts',
  ANIMAL_QUARANTINE: 'Animal Quarantine',
  PLANT_QUARANTINE: 'Plant Quarantine',
  TRANSPORT: 'Transport',
  AASL_VEHICLE_PASS: 'AASL Vehicle Pass',
  LABOUR: 'Labour',
  SRILANKAN_SECURITY_OFFICER_EXPENSES: 'SriLankan Security Officer Expenses',
  INSPECTION: 'Inspection',
  OPERATIONAL: 'Operational',
  OTHER: 'Other',
};

/** A plain HTML input submits "" when left blank — see shipment.ts's identical helper. */
const optional = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), inner.optional());

/** LKR, optional per line (PRD/CONTEXT §12). */
const lkrAmount = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Expected a positive amount with up to 2 decimal places')
  .refine((value) => Number(value) > 0, 'Amount must be positive');

export const createCostSheetRequestSchema = z.object({
  shipmentId: z.string().min(1, 'Shipment is required'),
  snNo: optional(z.string().trim().min(1)),
});
export type CreateCostSheetRequest = z.infer<typeof createCostSheetRequestSchema>;

/** `version` is mandatory — optimistic-lock check (ARCHITECTURE §20), same discipline as shipment/cargo. */
export const updateCostSheetRequestSchema = z.object({
  version: z.number().int().nonnegative(),
  snNo: optional(z.string().trim().min(1)),
  remarks: optional(z.string().trim().min(1)),
  shiftLeaderSignature: optional(z.string().trim().min(1)),
  lines: z.record(z.enum(COST_SHEET_LINE_TYPES), optional(lkrAmount)).optional(),
});
export type UpdateCostSheetRequest = z.infer<typeof updateCostSheetRequestSchema>;

export const costSheetLineSchema = z.object({
  lineType: z.enum(COST_SHEET_LINE_TYPES),
  amount: z.string().nullable(),
});
export type CostSheetLine = z.infer<typeof costSheetLineSchema>;

export const costSheetSchema = z.object({
  id: z.string(),
  shipmentId: z.string(),
  shipmentNo: z.string(),
  snNo: z.string().nullable(),
  status: z.enum(COST_SHEET_STATUSES),
  remarks: z.string().nullable(),
  shiftLeaderSignature: z.string().nullable(),
  lines: z.array(costSheetLineSchema),
  // Computed server-side from `lines` — never stored (DEVELOPMENT_RULES §5).
  total: z.string(),
  version: z.number().int(),
  createdByUserId: z.string(),
  releasedByUserId: z.string().nullable(),
  releasedAt: z.string().nullable(),
  approvedByUserId: z.string().nullable(),
  approvedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CostSheet = z.infer<typeof costSheetSchema>;
