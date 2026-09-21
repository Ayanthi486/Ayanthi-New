import { useState } from 'react';
import {
  COST_SHEET_LINE_LABELS,
  COST_SHEET_LINE_TYPES,
  type CostSheet,
  type CostSheetLineType,
  type PermissionKey,
} from '@hub-lanka/shared';
import { RequirePermission } from '@/app/RequirePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useShipment } from '@/features/shipments/hooks/useShipments';
import type { Shipment } from '@hub-lanka/shared';
import { LOGO_BASE64 } from './logo';
import {
  useApproveCostSheet,
  useCostSheet,
  useCreateCostSheet,
  useReleaseCostSheet,
  useUpdateCostSheet,
} from '@/features/costsheet/hooks/useCostSheet';
import { ApiClientError } from '@/lib/apiClient';
import { escapeHtml } from '@/lib/utils';
import { useAuthStore } from '@/lib/authStore';
import { downloadSignature } from '@/features/profile/api/profileApi';
import { useEffect } from 'react';

const formatAmount = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '';
  const strVal = String(val);
  const num = parseFloat(strVal.replace(/,/g, ''));
  if (isNaN(num)) return strVal;
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};



function printCostSheet(costSheet: CostSheet, shipment: Shipment, signatureBase64: string | null): void {
  const printWindow = window.open('about:blank', '_blank');
  if (!printWindow) return;

  const rows = COST_SHEET_LINE_TYPES.map((type) => {
    const amount = costSheet.lines.find((line) => line.lineType === type)?.amount;
    const displayAmount = amount ? formatAmount(amount) : '0.00';
    return `<tr><td style="border: 1px solid #000; padding: 4px;">${escapeHtml(COST_SHEET_LINE_LABELS[type])}</td><td style="border: 1px solid #000; padding: 4px; text-align:right;">${escapeHtml(displayAmount)}</td></tr>`;
  }).join('');

  const formatFlightDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const combinedFlight = shipment.flightNo ? (shipment.airlineCode ? `${shipment.airlineCode}${shipment.flightNo}` : shipment.flightNo) : null;
  const flightStr = combinedFlight ? `${escapeHtml(combinedFlight)} - ${formatFlightDate(shipment.flightDate)}` : formatFlightDate(shipment.flightDate);

  const html = `<!doctype html>
    <html>
      <head>
        <title>Cost Sheet</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #000; font-size: 10pt; }
          table { width: 100%; border-collapse: collapse; }
          td, th { border: 1px solid #000; padding: 4px; text-align: left; vertical-align: middle; }
        </style>
      </head>
      <body>
        <table style="width: 100%; border: none; margin-bottom: 10px;">
          <tr>
            <td style="border: none; padding: 0; text-align: left; vertical-align: top;">
              <div style="font-size: 16pt; font-weight: bold; margin-bottom: 2px; font-family: 'Arial Black', Impact, sans-serif;">H U B Lanka (Pvt) Ltd</div>
              <div style="font-size: 9pt; margin-bottom: 2px;">Terminal 3-1F--17 Air Cargo Village,Katunayake,Sri Lanka.</div>
              <div style="font-size: 9pt;">M +94760120210 |T +94112254879 | E-mail : airportoperations@hublanka.lk</div>
            </td>
            <td style="border: none; padding: 0; text-align: right; vertical-align: top;">
              <img src="${LOGO_BASE64}" style="height: 60px;" alt="Logo" />
            </td>
          </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9.5pt;">
          <tr>
            <th colspan="4" style="text-align: center; font-size: 11pt; font-weight: bold; padding: 4px; border: 1px solid #000; background-color: #e5e7eb;">
              Shipment Cost Sheet
            </th>
          </tr>
          <tr>
            <td style="width: 25%; font-weight: bold; border: 1px solid #000; padding: 4px;">S/N No</td>
            <td style="width: 25%; border: 1px solid #000; padding: 4px;">${escapeHtml(costSheet.snNo ?? '')}</td>
            <td style="width: 25%; font-weight: bold; border: 1px solid #000; padding: 4px;">Commodity</td>
            <td style="width: 25%; border: 1px solid #000; padding: 4px;">${escapeHtml(shipment.commodityName ?? '')}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px;">MAWB No</td>
            <td style="border: 1px solid #000; padding: 4px;">${escapeHtml(shipment.mawbNo ?? '')}</td>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px;">Boxes</td>
            <td style="border: 1px solid #000; padding: 4px;">${escapeHtml(shipment.boxCount ?? '')}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px;">Flight No & Date</td>
            <td style="border: 1px solid #000; padding: 4px;">${flightStr}</td>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px;">Weight</td>
            <td style="border: 1px solid #000; padding: 4px;">${escapeHtml(shipment.weightKg ?? '')} KGS</td>
          </tr>
          <tr>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px;">Shipper Name</td>
            <td style="border: 1px solid #000; padding: 4px;">${escapeHtml(shipment.shipperName ?? '')}</td>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px;">Cusdec No</td>
            <td style="border: 1px solid #000; padding: 4px;">${escapeHtml(shipment.cusdecNo ?? '')}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px;">Consignee Name</td>
            <td style="border: 1px solid #000; padding: 4px;">${escapeHtml(shipment.consigneeName ?? '')}</td>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px;">Shift Leader Name</td>
            <td style="border: 1px solid #000; padding: 4px;">${escapeHtml(costSheet.shiftLeaderSignature ?? '')}</td>
          </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
          <thead>
            <tr>
              <th style="font-weight: bold; border: 1px solid #000; padding: 4px; text-align: left; background-color: #e5e7eb;">Expenses</th>
              <th style="font-weight: bold; border: 1px solid #000; padding: 4px; text-align: right; background-color: #e5e7eb;">Amount in LKR</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td style="font-weight: bold; border: 1px solid #000; padding: 4px; text-align: right;">Total</td>
              <td style="font-weight: bold; border: 1px solid #000; padding: 4px; text-align: right;">${escapeHtml(formatAmount(costSheet.total))}</td>
            </tr>
          </tfoot>
        </table>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px; width: 25%; vertical-align: top;">Remarks</td>
            <td style="border: 1px solid #000; padding: 4px; vertical-align: top; min-height: 40px;">${escapeHtml(costSheet.remarks ?? '')}</td>
          </tr>
        </table>

        <table style="width: 100%; border: none; margin-top: 30px;">
          <tr>
            <td style="border: none; padding: 4px; text-align: left; width: 33%; vertical-align: bottom;">
              <div style="height: 50px; margin-bottom: 5px;">
                ${signatureBase64 ? `<img src="${signatureBase64}" style="max-height: 50px; mix-blend-mode: multiply;" alt="Signature" />` : ''}
              </div>
              <div style="border-top: 1px solid #000; width: 80%; padding-top: 2px;">Prepared By</div>
            </td>
            <td style="border: none; padding: 4px; text-align: left; width: 33%; vertical-align: bottom;">
              <div style="height: 50px; margin-bottom: 5px;"></div>
              <div style="border-top: 1px solid #000; width: 80%; padding-top: 2px;">Checked By</div>
            </td>
            <td style="border: none; padding: 4px; text-align: left; width: 33%; vertical-align: bottom;">
              <div style="height: 50px; margin-bottom: 5px;"></div>
              <div style="border-top: 1px solid #000; width: 80%; padding-top: 2px;">Approved By</div>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
  const fullHtml = html + `<script>window.onload = () => setTimeout(() => { window.print(); }, 200);</script>`;
  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();
}

/** PRD §5.3/CONTEXT.md §12: release -> review -> approve. Rendered as one tab pane inside DocumentsSection.tsx's unified tab bar — no card/heading of its own, that's the shared tab container's job. */
export function CostSheetSection({ shipmentId }: { shipmentId: string }) {
  const costSheetQuery = useCostSheet(shipmentId);
  const createMutation = useCreateCostSheet(shipmentId);
  const [confirmingCreate, setConfirmingCreate] = useState(false);
  const user = useAuthStore((state) => state.user);
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (user?.hasSignature) {
      downloadSignature()
        .then((blob) => {
          if (!active) return;
          const reader = new FileReader();
          reader.onloadend = () => {
            if (active) setSignatureBase64(reader.result as string);
          };
          reader.readAsDataURL(blob);
        })
        .catch(() => {});
    } else {
      setSignatureBase64(null);
    }
    return () => { active = false; };
  }, [user?.hasSignature]);

  const notFound =
    costSheetQuery.isError &&
    costSheetQuery.error instanceof ApiClientError &&
    costSheetQuery.error.status === 404;

  return (
    <div>
      <p className="text-muted-foreground text-sm">
        Hub Lanka's internal operational expenses, in LKR.
      </p>

      {costSheetQuery.isLoading && <p className="text-muted-foreground mt-4 text-sm">Loading…</p>}

      {notFound && (
        <div className="mt-4">
          <p className="text-muted-foreground text-sm">No Cost Sheet has been prepared yet.</p>
          <RequirePermission permission="costsheet.prepare">
            {confirmingCreate ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm">Create a Cost Sheet?</span>
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
                Create Cost Sheet
              </Button>
            )}
          </RequirePermission>
        </div>
      )}

      {costSheetQuery.isError && !notFound && (
        <p className="text-destructive mt-4 text-sm">Unable to load the Cost Sheet.</p>
      )}

      {costSheetQuery.data && (
        // Keyed by version so a server-side change (release/approve, or
        // another user's edit) remounts this with fresh local edit state
        // instead of needing an effect to sync props into state.
        <CostSheetDetail
          key={costSheetQuery.data.version}
          shipmentId={shipmentId}
          costSheet={costSheetQuery.data}
          signatureBase64={signatureBase64}
        />
      )}
    </div>
  );
}

function CostSheetDetail({ shipmentId, costSheet, signatureBase64 }: { shipmentId: string; costSheet: CostSheet; signatureBase64: string | null }) {
  const shipmentQuery = useShipment(shipmentId);
  const updateMutation = useUpdateCostSheet(shipmentId);
  const releaseMutation = useReleaseCostSheet(shipmentId);
  const approveMutation = useApproveCostSheet(shipmentId);

  const [isEditing, setIsEditing] = useState(false);
  const [snNo, setSnNo] = useState(costSheet.snNo ?? '');
  const [remarks, setRemarks] = useState(costSheet.remarks ?? '');
  const [shiftLeaderSignature, setShiftLeaderSignature] = useState(
    costSheet.shiftLeaderSignature ?? '',
  );
  const [lineAmounts, setLineAmounts] = useState<Record<CostSheetLineType, string>>(
    () =>
      Object.fromEntries(
        costSheet.lines.map((line) => [line.lineType, line.amount ? formatAmount(line.amount) : '']),
      ) as Record<CostSheetLineType, string>,
  );

  const isApproved = costSheet.status === 'APPROVED';
  // Draft/Released: Executive or Manager (costsheet.prepare covers both, no
  // OR needed — see RequirePermission's doc comment). Approved: Executive
  // loses edit access — only costsheet.edit_approved (Manager) can still edit.
  const editPermission: PermissionKey = isApproved ? 'costsheet.edit_approved' : 'costsheet.prepare';

  const resetFields = () => {
    setSnNo(costSheet.snNo ?? '');
    setRemarks(costSheet.remarks ?? '');
    setShiftLeaderSignature(costSheet.shiftLeaderSignature ?? '');
    setLineAmounts(
      Object.fromEntries(
        costSheet.lines.map((line) => [line.lineType, line.amount ? formatAmount(line.amount) : '']),
      ) as Record<CostSheetLineType, string>,
    );
  };

  const handleEdit = () => {
    resetFields();
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    resetFields();
    setIsEditing(false);
  };

  const handleSave = () => {
    updateMutation.mutate(
      {
        id: costSheet.id,
        input: {
          version: costSheet.version,
          snNo: snNo || undefined,
          remarks: remarks || undefined,
          shiftLeaderSignature: shiftLeaderSignature || undefined,
          lines: Object.fromEntries(
            COST_SHEET_LINE_TYPES.map((type) => [type, lineAmounts[type] ? lineAmounts[type].replace(/,/g, '') : undefined]),
          ) as Record<CostSheetLineType, string | undefined>,
        },
      },
      { onSuccess: () => setIsEditing(false) },
    );
  };

  

  return (
    <div className="mt-4 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="bg-brand-navy/10 text-brand-navy rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide uppercase">
            {costSheet.status}
          </span>
          {costSheet.approvedAt && (
            <span className="text-muted-foreground text-xs font-medium">
              Approved {new Date(costSheet.approvedAt).toLocaleString()}
            </span>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => printCostSheet(costSheet, shipmentQuery.data!, signatureBase64)}
            disabled={!shipmentQuery.data}>
            Print
          </Button>

          <RequirePermission permission={editPermission}>
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={updateMutation.isPending}
                  onClick={handleCancelEdit}
                >
                  Cancel
                </Button>
                <Button size="sm" disabled={updateMutation.isPending} onClick={handleSave}>
                  {updateMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={handleEdit}>
                Edit
              </Button>
            )}
          </RequirePermission>

          {costSheet.status === 'DRAFT' && (
            <RequirePermission permission="costsheet.prepare">
              <Button
                size="sm"
                disabled={releaseMutation.isPending}
                onClick={() => releaseMutation.mutate(costSheet.id)}
              >
                {releaseMutation.isPending ? 'Releasing…' : 'Release'}
              </Button>
            </RequirePermission>
          )}

          {costSheet.status === 'RELEASED' && (
            <RequirePermission permission="costsheet.approve">
              <Button
                size="sm"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate(costSheet.id)}
              >
                {approveMutation.isPending ? 'Approving…' : 'Approve'}
              </Button>
            </RequirePermission>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Header fields */}
        <div className="col-span-1 sm:col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="cs-snNo" className={!isEditing ? 'text-muted-foreground text-[11px] font-medium tracking-wide uppercase' : ''}>S/N No</Label>
          {isEditing ? (
            <Input
              id="cs-snNo"
              value={snNo}
              onChange={(e) => setSnNo(e.target.value)}
            />
          ) : (
            <div className="text-foreground text-sm font-medium">{snNo || '—'}</div>
          )}
        </div>

        {/* Lines */}
        {COST_SHEET_LINE_TYPES.map((type) => (
          <div key={type} className="flex flex-col gap-1.5">
            <Label htmlFor={`cs-line-${type}`} className={!isEditing ? 'text-muted-foreground text-[11px] font-medium tracking-wide uppercase' : ''}>
              {COST_SHEET_LINE_LABELS[type]}
            </Label>
            {isEditing ? (
              <Input
                id={`cs-line-${type}`}
                inputMode="decimal"
                placeholder="0.00"
                value={lineAmounts[type] ?? ''}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                  setLineAmounts((prev) => ({ ...prev, [type]: cleaned }));
                }}
                onBlur={() => {
                  setLineAmounts((prev) => {
                    const val = prev[type];
                    if (!val) return prev;
                    const num = parseFloat(val.replace(/,/g, ''));
                    if (isNaN(num)) return prev;
                    return { ...prev, [type]: formatAmount(num.toString()) };
                  });
                }}
              />
            ) : (
              <div className="text-foreground text-sm font-medium">
                {lineAmounts[type] ? `LKR ${formatAmount(lineAmounts[type])}` : '—'}
              </div>
            )}
          </div>
        ))}

        {/* Footer fields */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cs-remarks" className={!isEditing ? 'text-muted-foreground text-[11px] font-medium tracking-wide uppercase' : ''}>Remarks</Label>
          {isEditing ? (
            <Input
              id="cs-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          ) : (
            <div className="text-foreground text-sm font-medium">{remarks || '—'}</div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cs-shiftLeader" className={!isEditing ? 'text-muted-foreground text-[11px] font-medium tracking-wide uppercase' : ''}>Shift Leader Name</Label>
          {isEditing ? (
            <Input
              id="cs-shiftLeader"
              value={shiftLeaderSignature}
              onChange={(e) => setShiftLeaderSignature(e.target.value)}
            />
          ) : (
            <div className="text-foreground text-sm font-medium">{shiftLeaderSignature || '—'}</div>
          )}
        </div>
      </div>

      <div className="flex justify-end border-t border-border/50 pt-4">
        <span className="text-xl font-bold tracking-tight text-foreground">Total: LKR {formatAmount(costSheet.total)}</span>
      </div>

      {(updateMutation.isError || releaseMutation.isError || approveMutation.isError) && (
        <p className="text-destructive text-sm">
          {[updateMutation.error, releaseMutation.error, approveMutation.error]
            .filter((e): e is ApiClientError => e instanceof ApiClientError)
            .map((e) => e.message)[0] ?? 'Unable to save the Cost Sheet.'}
        </p>
      )}
    </div>
  );
}
