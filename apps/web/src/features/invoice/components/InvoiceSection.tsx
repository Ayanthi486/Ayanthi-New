import { useState } from 'react';
import {
  INVOICE_LINE_WEIGHT_BASES,
  type Invoice,
  type InvoiceLineInput,
  type InvoiceLineWeightBasis,
} from '@hub-lanka/shared';
import { RequirePermission } from '@/app/RequirePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaymentSection } from '@/features/payment/components/PaymentSection';
import {
  useCreateInvoice,
  useInvoice,
  useIssueInvoice,
  useUpdateInvoice,
} from '@/features/invoice/hooks/useInvoice';
import { ApiClientError } from '@/lib/apiClient';
import { escapeHtml } from '@/lib/utils';

const WEIGHT_BASIS_LABELS: Record<InvoiceLineWeightBasis, string> = {
  CHARGEABLE: 'Chargeable Wt',
  GROSS: 'Gross Wt',
  FLAT: 'Flat',
};

const selectClassName = 'border-input h-9 rounded-md border bg-transparent px-3 text-sm';

function printInvoice(invoice: Invoice): void {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) return;

  const rows = invoice.lines
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.description)}</td><td>${escapeHtml(WEIGHT_BASIS_LABELS[line.weightBasis])}</td><td style="text-align:right">${escapeHtml(line.rateUsd)}</td></tr>`,
    )
    .join('');

  printWindow.document.write(`
    <html>
      <head>
        <title>Invoice ${escapeHtml(invoice.invoiceNo ?? '')}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: sans-serif; padding: 2rem; color: #111; }
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          td, th { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
          h1 { margin-bottom: 0.25rem; }
        </style>
      </head>
      <body>
        <h1>Invoice ${escapeHtml(invoice.invoiceNo || '(no number)')}</h1>
        <p>Date: ${escapeHtml(invoice.invoiceDate ?? '—')}</p>
        <p>AWB Number: ${escapeHtml(invoice.awbNumber ?? '—')}</p>
        <p>Shipper: ${escapeHtml(invoice.shipperName ?? '—')}</p>
        <p>Consignee: ${escapeHtml(invoice.consigneeName ?? '—')}</p>
        <table>
          <thead><tr><th>Description</th><th>Weight basis</th><th>Rate (USD)</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p><strong>Total USD: ${escapeHtml(invoice.totalUsd)}</strong></p>
        <p><strong>Total LKR: ${escapeHtml(invoice.totalLkr)}</strong></p>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

/** PRD §5.4/§6/§8/§9, CONTEXT.md §13: Manager-owned, dual currency, create -> edit -> issue. Rendered as one tab pane ("Freight Invoice") inside DocumentsSection.tsx's unified tab bar — no card/heading of its own. */
export function InvoiceSection({ shipmentId }: { shipmentId: string }) {
  const invoiceQuery = useInvoice(shipmentId);
  const createMutation = useCreateInvoice(shipmentId);
  const [confirmingCreate, setConfirmingCreate] = useState(false);

  const notFound =
    invoiceQuery.isError &&
    invoiceQuery.error instanceof ApiClientError &&
    invoiceQuery.error.status === 404;

  return (
    <div>
      <p className="text-muted-foreground text-sm">
        Customer selling charges, dual currency LKR/USD.
      </p>

      {invoiceQuery.isLoading && <p className="text-muted-foreground mt-4 text-sm">Loading…</p>}

      {notFound && (
        <div className="mt-4">
          <p className="text-muted-foreground text-sm">No Invoice has been created yet.</p>
          <RequirePermission permission="invoice.manage">
            {confirmingCreate ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm">Create an Invoice?</span>
                <Button
                  disabled={createMutation.isPending}
                  onClick={() => createMutation.mutate({ shipmentId })}
                >
                  {createMutation.isPending ? 'Creating…' : 'Confirm'}
                </Button>
                <Button
                  variant="outline"
                  disabled={createMutation.isPending}
                  onClick={() => setConfirmingCreate(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button className="mt-2" onClick={() => setConfirmingCreate(true)}>
                Create Invoice
              </Button>
            )}
          </RequirePermission>
        </div>
      )}

      {invoiceQuery.isError && !notFound && (
        <p className="text-destructive mt-4 text-sm">Unable to load the Invoice.</p>
      )}

      {invoiceQuery.data && (
        // Keyed by version so a server-side change (issue, or another user's
        // edit) remounts this with fresh local edit state instead of needing
        // an effect to sync props into state.
        <InvoiceDetail
          key={invoiceQuery.data.version}
          shipmentId={shipmentId}
          invoice={invoiceQuery.data}
        />
      )}
    </div>
  );
}

function linesFromInvoice(invoice: Invoice): InvoiceLineInput[] {
  return invoice.lines.map((line) => ({
    description: line.description,
    weightBasis: line.weightBasis,
    rateUsd: line.rateUsd,
  }));
}

function InvoiceDetail({ shipmentId, invoice }: { shipmentId: string; invoice: Invoice }) {
  const updateMutation = useUpdateInvoice(shipmentId);
  const issueMutation = useIssueInvoice(shipmentId);

  const [isEditing, setIsEditing] = useState(false);
  const [invoiceNo, setInvoiceNo] = useState(invoice.invoiceNo ?? '');
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoiceDate ?? '');
  const [exchangeRate, setExchangeRate] = useState(invoice.exchangeRate ?? '');
  const [termDays, setTermDays] = useState(
    invoice.termDays !== null ? String(invoice.termDays) : '',
  );
  const [chargeableWeightKg, setChargeableWeightKg] = useState(invoice.chargeableWeightKg ?? '');
  const [lines, setLines] = useState<InvoiceLineInput[]>(() => linesFromInvoice(invoice));

  const isIssued = invoice.status === 'ISSUED';
  const fieldsDisabled = isIssued || !isEditing;

  const resetFields = () => {
    setInvoiceNo(invoice.invoiceNo ?? '');
    setInvoiceDate(invoice.invoiceDate ?? '');
    setExchangeRate(invoice.exchangeRate ?? '');
    setTermDays(invoice.termDays !== null ? String(invoice.termDays) : '');
    setChargeableWeightKg(invoice.chargeableWeightKg ?? '');
    setLines(linesFromInvoice(invoice));
  };

  const handleEdit = () => {
    resetFields();
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    resetFields();
    setIsEditing(false);
  };

  const updateLine = (index: number, changes: Partial<InvoiceLineInput>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...changes } : line)));
  };
  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };
  const addLine = () => {
    setLines((prev) => [...prev, { description: '', weightBasis: 'FLAT', rateUsd: '' }]);
  };
  const moveLine = (index: number, direction: -1 | 1) => {
    setLines((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const line = next[index];
      const other = next[target];
      if (!line || !other) return prev;
      next[index] = other;
      next[target] = line;
      return next;
    });
  };

  const handleSave = () => {
    updateMutation.mutate(
      {
        id: invoice.id,
        input: {
          version: invoice.version,
          invoiceNo: invoiceNo || undefined,
          invoiceDate: invoiceDate || undefined,
          exchangeRate: exchangeRate || undefined,
          termDays: termDays ? Number(termDays) : undefined,
          chargeableWeightKg: chargeableWeightKg || undefined,
          lines: lines.length > 0 ? lines : undefined,
        },
      },
      { onSuccess: () => setIsEditing(false) },
    );
  };

  const handleIssue = () => {
    issueMutation.mutate({ id: invoice.id, idempotencyKey: crypto.randomUUID() });
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="bg-muted rounded px-2 py-0.5 text-xs font-medium">{invoice.status}</span>
        {invoice.issuedAt && (
          <span className="text-muted-foreground text-xs">
            Issued {new Date(invoice.issuedAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* Header fields resolved live from the Shipment/Shipper/Consignee/Commodity/Airport relations (BR-35) — read-only here. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ReadOnlyField label="AWB Number" value={invoice.awbNumber} />
        <ReadOnlyField label="Flights" value={invoice.flights} />
        <ReadOnlyField label="ETD Colombo" value={invoice.etdColombo} />
        <ReadOnlyField label="Dest" value={invoice.destinationAirportCode} />
        <ReadOnlyField label="Commodity" value={invoice.commodityName} />
        <ReadOnlyField label="Shipper" value={invoice.shipperName} />
        <ReadOnlyField label="Shipper Address" value={invoice.shipperAddress} />
        <ReadOnlyField label="Consignee" value={invoice.consigneeName} />
        <ReadOnlyField
          label="No. of Pkgs"
          value={invoice.noOfPkgs !== null ? String(invoice.noOfPkgs) : null}
        />
        <ReadOnlyField label="Gross Wt" value={invoice.grossWeightKg} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-invoiceNo">Invoice No</Label>
          <Input
            id="inv-invoiceNo"
            value={invoiceNo}
            disabled={fieldsDisabled}
            onChange={(e) => setInvoiceNo(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-invoiceDate">Invoice Date</Label>
          <Input
            id="inv-invoiceDate"
            type="date"
            value={invoiceDate}
            disabled={fieldsDisabled}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-term">Term (days)</Label>
          <Input
            id="inv-term"
            inputMode="numeric"
            value={termDays}
            disabled={fieldsDisabled}
            onChange={(e) => setTermDays(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-exchangeRate">AWB Ex-Rate</Label>
          <Input
            id="inv-exchangeRate"
            inputMode="decimal"
            value={exchangeRate}
            disabled={fieldsDisabled}
            onChange={(e) => setExchangeRate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-chargeableWt">Chargeable Wt</Label>
          <Input
            id="inv-chargeableWt"
            inputMode="decimal"
            value={chargeableWeightKg}
            disabled={fieldsDisabled}
            onChange={(e) => setChargeableWeightKg(e.target.value)}
          />
        </div>
        <ReadOnlyField label="Due Date" value={invoice.dueDate} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Charge lines</span>
        {lines.map((line, index) => (
          <div
            key={index}
            className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_9rem_8rem_auto]"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`inv-line-desc-${index}`}>Description</Label>
              <Input
                id={`inv-line-desc-${index}`}
                value={line.description}
                disabled={fieldsDisabled}
                onChange={(e) => updateLine(index, { description: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`inv-line-basis-${index}`}>Weight basis</Label>
              <select
                id={`inv-line-basis-${index}`}
                className={selectClassName}
                value={line.weightBasis}
                disabled={fieldsDisabled}
                onChange={(e) =>
                  updateLine(index, { weightBasis: e.target.value as InvoiceLineWeightBasis })
                }
              >
                {INVOICE_LINE_WEIGHT_BASES.map((basis) => (
                  <option key={basis} value={basis}>
                    {WEIGHT_BASIS_LABELS[basis]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`inv-line-rate-${index}`}>Rate (USD)</Label>
              <Input
                id={`inv-line-rate-${index}`}
                inputMode="decimal"
                value={line.rateUsd}
                disabled={fieldsDisabled}
                onChange={(e) => updateLine(index, { rateUsd: e.target.value })}
              />
            </div>
            {!isIssued && isEditing && (
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => moveLine(index, -1)}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => moveLine(index, 1)}
                >
                  ↓
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => removeLine(index)}>
                  Remove
                </Button>
              </div>
            )}
          </div>
        ))}
        {!isIssued && isEditing && (
          <Button type="button" variant="outline" className="w-fit" onClick={addLine}>
            Add line
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-3">
        <div>
          <div className="text-muted-foreground text-xs">Total USD</div>
          <div className="text-lg font-semibold">{invoice.totalUsd}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Total LKR</div>
          <div className="text-lg font-semibold">{invoice.totalLkr}</div>
        </div>
        {invoice.airlineBuyingCostUsd !== null && (
          <div>
            {/* BR-41/66: internal only — never printed on the customer-facing invoice. */}
            <div className="text-muted-foreground text-xs">Airline buying cost (internal)</div>
            <div className="text-sm">USD {invoice.airlineBuyingCostUsd}</div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => printInvoice(invoice)}>
          Print
        </Button>

        {!isIssued && (
          <RequirePermission permission="invoice.manage">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  disabled={updateMutation.isPending}
                  onClick={handleCancelEdit}
                >
                  Cancel
                </Button>
                <Button disabled={updateMutation.isPending} onClick={handleSave}>
                  {updateMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={handleEdit}>
                Edit
              </Button>
            )}
          </RequirePermission>
        )}
        {!isIssued && (
          <RequirePermission permission="invoice.manage">
            <Button disabled={issueMutation.isPending} onClick={handleIssue}>
              {issueMutation.isPending ? 'Issuing…' : 'Issue'}
            </Button>
          </RequirePermission>
        )}
      </div>

      {(updateMutation.isError || issueMutation.isError) && (
        <p className="text-destructive text-sm">
          {[updateMutation.error, issueMutation.error]
            .filter((e): e is ApiClientError => e instanceof ApiClientError)
            .map((e) => e.message)[0] ?? 'Unable to save the Invoice.'}
        </p>
      )}

      {/* CONTEXT.md §14's own diagram: "Invoice issued (Manager) -> partial payment(s)". */}
      {isIssued && <PaymentSection invoiceId={invoice.id} />}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-sm">{value ?? '—'}</div>
    </div>
  );
}
