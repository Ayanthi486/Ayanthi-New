import type { Payment as SharedPayment, PaymentCurrency } from '@hub-lanka/shared';
import { BusinessRuleError } from '../common/errors/app-error';
import { Prisma } from '../generated/prisma/client';

type DecimalLike = { toString(): string };

export interface PaymentRow {
  id: string;
  invoiceId: string;
  amount: DecimalLike;
  currency: PaymentCurrency;
  paymentDate: Date;
  method: string | null;
  reference: string | null;
  receiptStorageKey: string | null;
  recordedByUserId: string;
  createdAt: Date;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toDecimal(value: DecimalLike | string): Prisma.Decimal {
  return new Prisma.Decimal(value.toString());
}

function round2(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2);
}

/**
 * Decision #1: a payment's USD-equivalent — the real invoice supports both a
 * USD wire transfer and a local LKR cheque (Payment Term A), so a USD payment
 * is used as-is and an LKR payment is converted at the invoice's own fixed
 * `exchangeRate`. Computed, never stored, same discipline as remaining balance.
 */
export function computeUsdEquivalent(
  amount: DecimalLike | string,
  currency: PaymentCurrency,
  exchangeRate: DecimalLike | string | null,
): Prisma.Decimal {
  const amountDecimal = toDecimal(amount);
  if (currency === 'USD') return amountDecimal;

  if (exchangeRate === null) {
    throw new BusinessRuleError(
      'The invoice exchange rate must be set before an LKR payment can be recorded',
    );
  }
  return round2(amountDecimal.div(toDecimal(exchangeRate)));
}

export interface PaymentSummaryResult {
  totalUsd: string;
  paidUsd: string;
  remainingUsd: string;
  isFullyPaid: boolean;
}

/** CONTEXT.md §14: remaining balance and "fully paid" are derived, never stored. */
export function computePaymentSummary(
  invoiceTotalUsd: DecimalLike | string,
  payments: { amount: DecimalLike | string; currency: PaymentCurrency }[],
  exchangeRate: DecimalLike | string | null,
): PaymentSummaryResult {
  const total = toDecimal(invoiceTotalUsd);
  const paid = payments.reduce(
    (sum, payment) =>
      sum.plus(computeUsdEquivalent(payment.amount, payment.currency, exchangeRate)),
    new Prisma.Decimal(0),
  );
  const remaining = total.minus(paid);

  return {
    totalUsd: total.toFixed(2),
    paidUsd: paid.toFixed(2),
    remainingUsd: remaining.toFixed(2),
    isFullyPaid: remaining.lte(0),
  };
}

export function toSharedPayment(row: PaymentRow): SharedPayment {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    amount: row.amount.toString(),
    currency: row.currency,
    paymentDate: formatDateOnly(row.paymentDate),
    method: row.method,
    reference: row.reference,
    hasReceipt: row.receiptStorageKey !== null,
    recordedByUserId: row.recordedByUserId,
    createdAt: row.createdAt.toISOString(),
  };
}
