import { useState } from 'react';
import { PAYMENT_CURRENCIES, type PaymentCurrency } from '@hub-lanka/shared';
import { RequirePermission } from '@/app/RequirePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useDownloadReceipt,
  useRecordPayment,
  usePayments,
} from '@/features/payment/hooks/usePayments';
import { ApiClientError } from '@/lib/apiClient';

const selectClassName = 'border-input h-9 rounded-md border bg-transparent px-3 text-sm';

/** PRD §5.4, CONTEXT.md §14: Manager records against an Issued invoice; Director views. BR-28/54/55/56/57. */
export function PaymentSection({ invoiceId }: { invoiceId: string }) {
  const paymentsQuery = usePayments(invoiceId);
  const recordMutation = useRecordPayment(invoiceId);
  const downloadMutation = useDownloadReceipt();

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<PaymentCurrency>('USD');
  const [paymentDate, setPaymentDate] = useState('');
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);

  const handleRecord = () => {
    recordMutation.mutate(
      {
        input: {
          amount,
          currency,
          paymentDate,
          method: method || undefined,
          reference: reference || undefined,
          receipt: receipt ?? undefined,
        },
        idempotencyKey: crypto.randomUUID(),
      },
      {
        onSuccess: () => {
          setAmount('');
          setMethod('');
          setReference('');
          setReceipt(null);
        },
      },
    );
  };

  const handleDownload = (paymentId: string) => {
    downloadMutation.mutate(paymentId, {
      onSuccess: ({ blob }) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
    });
  };

  return (
    <div className="border-border bg-card mt-4 rounded-lg border p-6">
      <h2 className="font-medium">Payments</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Partial payments through to fully paid (BR-54, BR-57).
      </p>

      {paymentsQuery.isLoading && <p className="text-muted-foreground mt-4 text-sm">Loading…</p>}
      {paymentsQuery.isError && (
        <p className="text-destructive mt-4 text-sm">Unable to load payments.</p>
      )}

      {paymentsQuery.data && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 border-b pb-4 sm:grid-cols-3">
            <div>
              <div className="text-muted-foreground text-xs">Total USD</div>
              <div className="text-lg font-semibold">{paymentsQuery.data.summary.totalUsd}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Remaining USD</div>
              <div className="text-lg font-semibold">{paymentsQuery.data.summary.remainingUsd}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Status</div>
              <span className="bg-muted rounded px-2 py-0.5 text-xs font-medium">
                {paymentsQuery.data.summary.isFullyPaid ? 'FULLY PAID' : 'PARTIALLY PAID'}
              </span>
            </div>
          </div>

          {paymentsQuery.data.payments.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-left text-xs">
                  <th className="pb-2 font-normal">Date</th>
                  <th className="pb-2 font-normal">Amount</th>
                  <th className="pb-2 font-normal">Method</th>
                  <th className="pb-2 font-normal">Reference</th>
                  <th className="pb-2 font-normal">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {paymentsQuery.data.payments.map((payment) => (
                  <tr key={payment.id} className="border-t">
                    <td className="py-2">{payment.paymentDate}</td>
                    <td className="py-2">
                      {payment.amount} {payment.currency}
                    </td>
                    <td className="py-2">{payment.method ?? '—'}</td>
                    <td className="py-2">{payment.reference ?? '—'}</td>
                    <td className="py-2">
                      {payment.hasReceipt ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={downloadMutation.isPending}
                          onClick={() => handleDownload(payment.id)}
                        >
                          View
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <RequirePermission permission="payment.record">
            {!paymentsQuery.data.summary.isFullyPaid && (
              <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pay-amount">Amount</Label>
                  <Input
                    id="pay-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pay-currency">Currency</Label>
                  <select
                    id="pay-currency"
                    className={selectClassName}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as PaymentCurrency)}
                  >
                    {PAYMENT_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pay-date">Payment Date</Label>
                  <Input
                    id="pay-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pay-method">Method</Label>
                  <Input
                    id="pay-method"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pay-reference">Reference</Label>
                  <Input
                    id="pay-reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pay-receipt">Receipt (PDF/JPEG/PNG)</Label>
                  <input
                    id="pay-receipt"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    className="text-sm"
                    onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="sm:col-span-3">
                  <Button
                    type="button"
                    disabled={recordMutation.isPending || !amount || !paymentDate}
                    onClick={handleRecord}
                  >
                    {recordMutation.isPending ? 'Recording…' : 'Record Payment'}
                  </Button>
                </div>
              </div>
            )}
          </RequirePermission>

          {recordMutation.isError && (
            <p className="text-destructive text-sm">
              {recordMutation.error instanceof ApiClientError
                ? recordMutation.error.message
                : 'Unable to record the payment.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
