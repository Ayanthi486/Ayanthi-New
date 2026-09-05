import { z } from 'zod';

/** CONTEXT.md §15: five tabs on the Shipment View, in this order. */
export const DOCUMENT_TYPES = ['SECURITY_CLEARANCE', 'AWB_STICKER', 'ADF', 'AWB', 'CDN'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = ['DRAFT', 'ISSUED'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** BR-63/decision #3: the only type with no issue/print/download action at all. */
export const ISSUABLE_DOCUMENT_TYPES = ['SECURITY_CLEARANCE', 'AWB_STICKER', 'AWB', 'CDN'] as const;
/** Decision #3: the only types that render a real stored PDF file (Download). AWB Sticker prints live HTML only. */
export const PDF_DOCUMENT_TYPES = ['SECURITY_CLEARANCE', 'AWB', 'CDN'] as const;

/** A plain HTML input submits "" when left blank — see shipment.ts's identical helper. */
const optional = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), inner.optional());

const optionalStr = () => optional(z.string().trim().min(1));

/**
 * PRD §9 manual fields: "Name, designation, NIC, handover and taken-charge blocks."
 * Matches the real form's three sections exactly (references/README.md's Security
 * Clearance inventory note) — shipper/agent certification, warf-officer handover,
 * taken-charge. Signature lines themselves are physical, not data fields.
 */
export const securityClearanceFieldsSchema = z.object({
  fullName: optionalStr(),
  designation: optionalStr(),
  organizationName: optionalStr(),
  nic: optionalStr(),
  certificationDate: optionalStr(),
  handoverEmployeeName: optionalStr(),
  handoverSNo: optionalStr(),
  handoverDesignation: optionalStr(),
  handoverNic: optionalStr(),
  handoverDate: optionalStr(),
  takenChargeName: optionalStr(),
  takenChargeStaffNo: optionalStr(),
  takenChargeDate: optionalStr(),
});
export type SecurityClearanceFields = z.infer<typeof securityClearanceFieldsSchema>;

/** PRD §9 manual fields: "Carrier template selection." The real sticker (references/documents/AWB_Stricker.jpg) has no barcode. */
export const awbStickerFieldsSchema = z.object({
  carrierName: optionalStr(),
});
export type AwbStickerFields = z.infer<typeof awbStickerFieldsSchema>;

const dimensionRowSchema = z.object({
  length: optionalStr(),
  width: optionalStr(),
  height: optionalStr(),
  pcs: optionalStr(),
});

/**
 * PRD §9 manual fields: "Dimensions table, CBM, ULD/BT number, acceptance pallet
 * no., tel, NIC, office-use times." Matches references/documents/ADF.jpg's real
 * layout (loose cargo vs GOH split, dimensions grid, ULD/BT and pallet number
 * tables, Weighing Receipt volume, and the Security/Confirmation office-use rows).
 */
export const adfFieldsSchema = z.object({
  shipperTel: optionalStr(),
  looseCargoPcs: optionalStr(),
  looseCargoWeightKg: optionalStr(),
  looseCargoCbm: optionalStr(),
  looseCargoContents: optionalStr(),
  gohPcs: optionalStr(),
  gohWeightKg: optionalStr(),
  gohCbm: optionalStr(),
  gohContents: optionalStr(),
  totalCbm: optionalStr(),
  dimensions: z.array(dimensionRowSchema).optional(),
  acceptancePallets: z.array(z.object({ palletNo: optionalStr(), pcs: optionalStr() })).optional(),
  uldBtNumbers: z.array(z.object({ number: optionalStr(), pcs: optionalStr() })).optional(),
  weighingReceiptVolumeM3: optionalStr(),
  certifierNic: optionalStr(),
  certifierDate: optionalStr(),
  securityReportedTime: optionalStr(),
  securityScreeningCompletedTime: optionalStr(),
  securityNameStaffNo: optionalStr(),
  confirmationSignatureStaffNo: optionalStr(),
  remarks: optionalStr(),
});
export type AdfFields = z.infer<typeof adfFieldsSchema>;

/**
 * PRD §9 manual fields: "IATA code, SHC codes, HS commodity codes, temperature
 * instructions, carrier charge codes, AWB exchange rate." The real MAWB
 * (references/documents/Air way bill.jpg) is a dense carrier-owned IATA form —
 * field_data intentionally captures PRD's confirmed groups plus the minimum
 * extra structure the layout needs (rate/weight/charge breakdown, routing),
 * not every cell 1:1; kept extensible per OQ-3.
 */
export const awbFieldsSchema = z.object({
  agentIataCode: optionalStr(),
  accountNo: optionalStr(),
  shcCodes: optionalStr(),
  hsCommodityCodes: optionalStr(),
  temperatureInstructions: optionalStr(),
  awbExchangeRate: optionalStr(),
  rateClass: optionalStr(),
  commodityItemNo: optionalStr(),
  ratePerKgOrCharge: optionalStr(),
  chargeableWeightKg: optionalStr(),
  totalCharge: optionalStr(),
  natureAndQuantityOfGoods: optionalStr(),
  routingTo1: optionalStr(),
  routingBy1: optionalStr(),
  routingTo2: optionalStr(),
  routingBy2: optionalStr(),
  requestedFlight1: optionalStr(),
  requestedFlight2: optionalStr(),
  declaredValueForCarriage: optionalStr(),
  declaredValueForCustoms: optionalStr(),
  amountOfInsurance: optionalStr(),
  weightCharge: optionalStr(),
  valuationCharge: optionalStr(),
  tax: optionalStr(),
  otherChargesAwc: optionalStr(),
  otherChargesNec: optionalStr(),
  otherChargesCgc: optionalStr(),
  otherChargesCha: optionalStr(),
  otherChargesFec: optionalStr(),
  otherChargesScc: optionalStr(),
  totalOtherChargesDueAgent: optionalStr(),
  totalOtherChargesDueCarrier: optionalStr(),
  totalPrepaid: optionalStr(),
  totalCollect: optionalStr(),
  executedOnDate: optionalStr(),
  executedAtPlace: optionalStr(),
  remarks: optionalStr(),
});
export type AwbFields = z.infer<typeof awbFieldsSchema>;

/**
 * PRD §9 manual fields: "Lorry/trailer no., tare wt, SLP no., agent seal no.,
 * driver, cleaner, net wt, cube m³, declarant, tel." Matches
 * references/documents/CDN.jpg's real 37-field SLPA layout; official-use
 * sections (Customs Export Office, SLPA Export/Supervising Officer) print
 * blank per PRD §9 and are not data-captured here.
 */
export const cdnFieldsSchema = z.object({
  lorryTrailerNo: optionalStr(),
  snBlNo: optionalStr(),
  tareWeightKg: optionalStr(),
  slpNo: optionalStr(),
  agentSealNo: optionalStr(),
  driverName: optionalStr(),
  cleanerName: optionalStr(),
  netWeightKg: optionalStr(),
  cubeM3: optionalStr(),
  declarantName: optionalStr(),
  telephoneNo: optionalStr(),
  voyageNoDate: optionalStr(),
  vessel: optionalStr(),
  portLoading: optionalStr(),
  portDischarge: optionalStr(),
  containerMarksAndNumbers: optionalStr(),
  descriptionOfGoods: optionalStr(),
  containerType: optionalStr(),
  containerHeight: optionalStr(),
  containerLength: optionalStr(),
  reeferTemperature: optionalStr(),
  placeOfDelivery: optional(z.enum(['CY', 'CFS', 'DOOR'])),
  placeOfReceipt: optional(z.enum(['CY', 'PORT', 'CFS', 'DOOR'])),
  remarks: optionalStr(),
});
export type CdnFields = z.infer<typeof cdnFieldsSchema>;

export const documentFieldsSchemaByType = {
  SECURITY_CLEARANCE: securityClearanceFieldsSchema,
  AWB_STICKER: awbStickerFieldsSchema,
  ADF: adfFieldsSchema,
  AWB: awbFieldsSchema,
  CDN: cdnFieldsSchema,
} as const;

export const saveDocumentRequestSchema = z.object({
  fieldData: z.record(z.string(), z.unknown()),
});
export type SaveDocumentRequest = z.infer<typeof saveDocumentRequestSchema>;

/** BR-07: computed server-side, never guessed client-side. */
export const documentReadinessSchema = z.object({
  ready: z.boolean(),
  missingFields: z.array(z.string()),
});
export type DocumentReadiness = z.infer<typeof documentReadinessSchema>;

export const shipmentDocumentSchema = z.object({
  id: z.string(),
  shipmentId: z.string(),
  type: z.enum(DOCUMENT_TYPES),
  version: z.number().int(),
  status: z.enum(DOCUMENT_STATUSES),
  fieldData: z.record(z.string(), z.unknown()),
  // Populated-from-shipment fields, resolved live for DRAFT (BR-35 — never duplicated in fieldData).
  viewModel: z.record(z.string(), z.unknown()),
  hasStoredFile: z.boolean(),
  createdByUserId: z.string(),
  issuedByUserId: z.string().nullable(),
  issuedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ShipmentDocument = z.infer<typeof shipmentDocumentSchema>;
