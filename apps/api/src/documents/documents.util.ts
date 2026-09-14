import type {
  DocumentReadiness,
  DocumentType,
  ShipmentDocument as SharedShipmentDocument,
} from '@hub-lanka/shared';
import { colomboToday } from '../shipment/shipment.util';

type DecimalLike = { toString(): string };

/** BR-07: the one confirmed message (CONTEXT.md §15) — never reworded. */
export const DOCUMENT_BLOCKED_MESSAGE =
  'Cannot generate document. Please enter Box and Weight information.';

export interface ReadinessShipment {
  boxCount: number | null;
  weightKg: DecimalLike | null;
}

/** BR-07: only BOX and WEIGHT gate readiness — nothing else is invented as a precondition. */
export function computeDocumentReadiness(shipment: ReadinessShipment): DocumentReadiness {
  const missingFields: string[] = [];
  if (shipment.boxCount === null) missingFields.push('boxCount');
  if (shipment.weightKg === null) missingFields.push('weightKg');
  return { ready: missingFields.length === 0, missingFields };
}

export interface DocumentShipmentRow {
  mawbNo: string | null;
  flightNo: string | null;
  airline: { code: string };
  flightDate: Date;
  cusdecNo: string | null;
  boxCount: number | null;
  weightKg: DecimalLike | null;
  destinationAirport: { code: string } | null;
  shipper: { name: string; address: string | null };
  consignee: { name: string; address: string | null };
  commodity: { name: string };
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatFlightForDoc(airlineCode: string | null | undefined, flightNo: string | null | undefined): string | null {
  if (!flightNo) return null;
  const code = (airlineCode || '').trim();
  let fNo = flightNo.trim();
  if (code && fNo.toUpperCase().startsWith(code.toUpperCase())) {
    fNo = fNo.slice(code.length).trim();
  }
  if (/^\d+$/.test(fNo) && fNo.length < 4) {
    fNo = fNo.padStart(4, '0');
  }
  return code ? `${code} ${fNo}` : fNo;
}

/** The preparer identity a Security Clearance certificate is signed under — never typed by hand, see buildShipmentViewModel's SECURITY_CLEARANCE case. */
export interface DocumentActor {
  fullName: string;
  idCardNo: string | null;
}

/** Direct request: fixed regardless of which Executive prepares the certificate. */
const SECURITY_CLEARANCE_DESIGNATION = 'Junior Executive';
const SECURITY_CLEARANCE_ORGANIZATION = 'HUB Lanka (Pvt) Ltd';

/**
 * BR-35 (single source of truth): the only fields each document type reads
 * from the Shipment/master-data — PRD §9's "Populated from Shipment" column,
 * field for field. Read live for DRAFT; copied into `snapshot` only at issue
 * (decision #5). Never stored a second time in `fieldData`.
 *
 * `actor` is only used by SECURITY_CLEARANCE, whose certification block and
 * date fields are populated from the preparer's own account/Profile and the
 * current date rather than typed — direct request, see
 * securityClearanceFieldsSchema's doc comment.
 */
export function buildShipmentViewModel(
  type: DocumentType,
  shipment: DocumentShipmentRow,
  actor: DocumentActor,
): Record<string, unknown> {
  const gross = shipment.weightKg ? shipment.weightKg.toString() : null;
  const destination = shipment.destinationAirport ? shipment.destinationAirport.code : null;

  switch (type) {
    case 'SECURITY_CLEARANCE': {
      const today = colomboToday();
      return {
        awbNo: shipment.mawbNo,
        cargoDescription: shipment.commodity.name,
        // Deliberately left blank ("keep space to enter") — not auto-filled
        // from the shipment, unlike every other field here.
        boxCount: null,
        weightKg: null,
        flightNo: formatFlightForDoc(shipment.airline?.code, shipment.flightNo),
        flightDate: formatDateOnly(shipment.flightDate),
        destination,
        shipperName: shipment.shipper.name,
        fullName: actor.fullName,
        designation: SECURITY_CLEARANCE_DESIGNATION,
        organizationName: SECURITY_CLEARANCE_ORGANIZATION,
        nic: actor.idCardNo,
        certificationDate: today,
        handoverDate: today,
        takenChargeDate: today,
      };
    }
    case 'AWB_STICKER':
      return {
        // Hub Lanka operates out of Colombo — every real specimen's origin
        // is CMB; there is no per-shipment "origin airport" field (only
        // destination is stored, matching the Air Waybill's own departure).
        origin: 'CMB',
        awbNo: shipment.mawbNo,
        destination,
        boxCount: shipment.boxCount,
      };
    case 'ADF':
      return {
        flightNo: formatFlightForDoc(shipment.airline?.code, shipment.flightNo),
        flightDate: formatDateOnly(shipment.flightDate),
        awbNo: shipment.mawbNo,
        // No separate multi-leg routing field exists on Shipment (mirrors
        // Invoice's Phase 5 "Flights" free-text precedent) — destination is
        // the closest confirmed proxy.
        routing: destination,
        cusdecNo: shipment.cusdecNo,
        shipperName: shipment.shipper.name,
        boxCount: shipment.boxCount,
        weightKg: gross,
      };
    case 'AWB':
      return {
        shipperName: shipment.shipper.name,
        shipperAddress: shipment.shipper.address,
        consigneeName: shipment.consignee.name,
        consigneeAddress: shipment.consignee.address,
        routing: destination,
        flightNo: formatFlightForDoc(shipment.airline?.code, shipment.flightNo),
        flightDate: formatDateOnly(shipment.flightDate),
        grossWeightKg: gross,
        commodityName: shipment.commodity.name,
        mawbNo: shipment.mawbNo,
      };
    case 'CDN':
      return {
        shipperName: shipment.shipper.name,
        shipperAddress: shipment.shipper.address,
        consigneeName: shipment.consignee.name,
        consigneeAddress: shipment.consignee.address,
        flightNo: formatFlightForDoc(shipment.airline?.code, shipment.flightNo),
        flightDate: formatDateOnly(shipment.flightDate),
        destination,
        mawbNo: shipment.mawbNo,
        boxCount: shipment.boxCount,
        weightKg: gross,
        commodityName: shipment.commodity.name,
        cusdecNo: shipment.cusdecNo,
      };
    case 'CUSDEC':
      // Uploaded document, no template render — viewModel is never displayed.
      return {};
  }
}

export interface ShipmentDocumentRow {
  id: string;
  shipmentId: string;
  type: DocumentType;
  version: number;
  status: 'DRAFT' | 'ISSUED';
  fieldData: unknown;
  storageKey: string | null;
  createdByUserId: string;
  issuedByUserId: string | null;
  issuedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toSharedDocument(
  row: ShipmentDocumentRow,
  viewModel: Record<string, unknown>,
): SharedShipmentDocument {
  return {
    id: row.id,
    shipmentId: row.shipmentId,
    type: row.type,
    version: row.version,
    status: row.status,
    fieldData: (row.fieldData ?? {}) as Record<string, unknown>,
    viewModel,
    hasStoredFile: row.storageKey !== null,
    createdByUserId: row.createdByUserId,
    issuedByUserId: row.issuedByUserId,
    issuedAt: row.issuedAt ? row.issuedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export { formatDateOnly };
