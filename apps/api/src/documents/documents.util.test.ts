import { describe, expect, it } from 'vitest';
import {
  buildShipmentViewModel,
  computeDocumentReadiness,
  DOCUMENT_BLOCKED_MESSAGE,
  toSharedDocument,
  type DocumentShipmentRow,
  type ShipmentDocumentRow,
} from './documents.util';

const baseShipment: DocumentShipmentRow = {
  mawbNo: '157 0659 8944',
  flightNo: 'QR0655',
  flightDate: new Date('2026-08-04T00:00:00.000Z'),
  cusdecNo: 'CUS-1',
  boxCount: 26,
  weightKg: { toString: () => '444.50' },
  destinationAirport: { code: 'MXP' },
  shipper: { name: 'OCEAN LINE SEA FOODS PVT LTD', address: 'MEDA MUKALANA WATTA' },
  consignee: { name: 'SEA FISH ITALIA SRL', address: 'VIA ROMA 1' },
  commodity: { name: 'FRESH FISH' },
};

describe('documents.util', () => {
  describe('computeDocumentReadiness — BR-07', () => {
    it('is ready once both BOX and WEIGHT exist', () => {
      expect(
        computeDocumentReadiness({ boxCount: 26, weightKg: { toString: () => '444.50' } }),
      ).toEqual({
        ready: true,
        missingFields: [],
      });
    });

    it('is blocked with the exact confirmed message when BOX is missing', () => {
      const result = computeDocumentReadiness({
        boxCount: null,
        weightKg: { toString: () => '444.50' },
      });
      expect(result.ready).toBe(false);
      expect(result.missingFields).toContain('boxCount');
    });

    it('is blocked when WEIGHT is missing', () => {
      const result = computeDocumentReadiness({ boxCount: 26, weightKg: null });
      expect(result.ready).toBe(false);
      expect(result.missingFields).toContain('weightKg');
    });

    it('the confirmed message text is exact (CONTEXT.md §15)', () => {
      expect(DOCUMENT_BLOCKED_MESSAGE).toBe(
        'Cannot generate document. Please enter Box and Weight information.',
      );
    });
  });

  describe("buildShipmentViewModel — BR-35 (only PRD §9's confirmed populated-from-shipment fields)", () => {
    it('Security Clearance: AWB, cargo description, BOX/WEIGHT, flight, date, destination, shipper', () => {
      const vm = buildShipmentViewModel('SECURITY_CLEARANCE', baseShipment);
      expect(vm).toEqual({
        awbNo: '157 0659 8944',
        cargoDescription: 'FRESH FISH',
        boxCount: 26,
        weightKg: '444.50',
        flightNo: 'QR0655',
        flightDate: '2026-08-04',
        destination: 'MXP',
        shipperName: 'OCEAN LINE SEA FOODS PVT LTD',
      });
    });

    it('AWB Sticker: AWB, origin (fixed CMB), destination, BOX — no barcode field', () => {
      const vm = buildShipmentViewModel('AWB_STICKER', baseShipment);
      expect(vm).toEqual({
        origin: 'CMB',
        awbNo: '157 0659 8944',
        destination: 'MXP',
        boxCount: 26,
      });
    });

    it('CDN: shipper+address, consignee+address, flight, destination, MAWB, BOX, weight, commodity, CUSDEC', () => {
      const vm = buildShipmentViewModel('CDN', baseShipment);
      expect(vm).toEqual({
        shipperName: 'OCEAN LINE SEA FOODS PVT LTD',
        shipperAddress: 'MEDA MUKALANA WATTA',
        consigneeName: 'SEA FISH ITALIA SRL',
        consigneeAddress: 'VIA ROMA 1',
        flightNo: 'QR0655',
        flightDate: '2026-08-04',
        destination: 'MXP',
        mawbNo: '157 0659 8944',
        boxCount: 26,
        weightKg: '444.50',
        commodityName: 'FRESH FISH',
        cusdecNo: 'CUS-1',
      });
    });

    it("never includes a field not in PRD §9's populated-from-shipment column (e.g. no houseAwbNo anywhere)", () => {
      for (const type of ['SECURITY_CLEARANCE', 'AWB_STICKER', 'ADF', 'AWB', 'CDN'] as const) {
        const vm = buildShipmentViewModel(type, baseShipment);
        expect(Object.keys(vm)).not.toContain('houseAwbNo');
      }
    });
  });

  describe('toSharedDocument', () => {
    const row: ShipmentDocumentRow = {
      id: 'doc-1',
      shipmentId: 'shipment-1',
      type: 'ADF',
      version: 1,
      status: 'DRAFT',
      fieldData: { shipperTel: '011123456' },
      storageKey: null,
      createdByUserId: 'user-1',
      issuedByUserId: null,
      issuedAt: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    };

    it('maps hasStoredFile false when there is no storage key', () => {
      const shared = toSharedDocument(row, {});
      expect(shared.hasStoredFile).toBe(false);
      expect(shared.fieldData).toEqual({ shipperTel: '011123456' });
    });

    it('maps hasStoredFile true once a PDF has been stored', () => {
      const shared = toSharedDocument({ ...row, storageKey: 'documents/abc.pdf' }, {});
      expect(shared.hasStoredFile).toBe(true);
    });
  });
});
