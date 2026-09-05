import { describe, expect, it } from 'vitest';
import {
  computePaymentSummary,
  computeUsdEquivalent,
  toSharedPayment,
  type PaymentRow,
} from './payment.util';

describe('payment.util', () => {
  describe('computeUsdEquivalent — decision #1', () => {
    it('a USD payment is used as-is', () => {
      expect(computeUsdEquivalent('500.00', 'USD', '340.50').toFixed(2)).toBe('500.00');
    });

    it('an LKR payment converts at the invoice exchange rate', () => {
      // 17,025.00 LKR at 340.50 = exactly 50.00 USD.
      expect(computeUsdEquivalent('17025.00', 'LKR', '340.50').toFixed(2)).toBe('50.00');
    });

    it('rounds the LKR-to-USD conversion to 2dp', () => {
      // 100 / 340.50 = 0.29369... -> 0.29
      expect(computeUsdEquivalent('100.00', 'LKR', '340.50').toFixed(2)).toBe('0.29');
    });

    it('throws recording an LKR payment when the invoice has no exchange rate', () => {
      expect(() => computeUsdEquivalent('100.00', 'LKR', null)).toThrow(/exchange rate/);
    });

    it('a USD payment needs no exchange rate at all', () => {
      expect(computeUsdEquivalent('100.00', 'USD', null).toFixed(2)).toBe('100.00');
    });
  });

  describe('computePaymentSummary — AC-16/AC-17', () => {
    it('accumulates partial payments across both currencies and reports the accurate remaining balance', () => {
      const summary = computePaymentSummary(
        '2482.09',
        [
          { amount: '1000.00', currency: 'USD' },
          { amount: '340.50', currency: 'LKR' }, // = 1.00 USD
        ],
        '340.50',
      );
      expect(summary.totalUsd).toBe('2482.09');
      expect(summary.paidUsd).toBe('1001.00');
      expect(summary.remainingUsd).toBe('1481.09');
      expect(summary.isFullyPaid).toBe(false);
    });

    it('is fully paid once cumulative payments reach exactly the invoice total', () => {
      const summary = computePaymentSummary(
        '2482.09',
        [
          { amount: '2000.00', currency: 'USD' },
          { amount: '482.09', currency: 'USD' },
        ],
        '340.50',
      );
      expect(summary.remainingUsd).toBe('0.00');
      expect(summary.isFullyPaid).toBe(true);
    });

    it('with no payments yet, the full total is remaining and it is not fully paid', () => {
      const summary = computePaymentSummary('2482.09', [], '340.50');
      expect(summary.paidUsd).toBe('0.00');
      expect(summary.remainingUsd).toBe('2482.09');
      expect(summary.isFullyPaid).toBe(false);
    });
  });

  describe('toSharedPayment', () => {
    const baseRow: PaymentRow = {
      id: 'pay-1',
      invoiceId: 'inv-1',
      amount: { toString: () => '500.00' },
      currency: 'USD',
      paymentDate: new Date('2026-08-20T00:00:00.000Z'),
      method: 'Bank Transfer',
      reference: 'TXN-123',
      receiptStorageKey: 'payments/abc.pdf',
      recordedByUserId: 'user-1',
      createdAt: new Date('2026-08-20T10:00:00.000Z'),
    };

    it('maps a row with a receipt to hasReceipt: true', () => {
      const shared = toSharedPayment(baseRow);
      expect(shared.paymentDate).toBe('2026-08-20');
      expect(shared.hasReceipt).toBe(true);
    });

    it('maps a row with no receipt to hasReceipt: false', () => {
      const shared = toSharedPayment({ ...baseRow, receiptStorageKey: null });
      expect(shared.hasReceipt).toBe(false);
    });
  });
});
