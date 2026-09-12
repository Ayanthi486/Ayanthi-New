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
import {
  useApproveCostSheet,
  useCostSheet,
  useCreateCostSheet,
  useReleaseCostSheet,
  useUpdateCostSheet,
} from '@/features/costsheet/hooks/useCostSheet';
import { ApiClientError } from '@/lib/apiClient';
import { escapeHtml } from '@/lib/utils';

function printCostSheet(costSheet: CostSheet): void {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) return;

  const rows = COST_SHEET_LINE_TYPES.map((type) => {
    const amount = costSheet.lines.find((line) => line.lineType === type)?.amount ?? '0.00';
    return `<tr><td>${escapeHtml(COST_SHEET_LINE_LABELS[type])}</td><td style="text-align:right">${escapeHtml(amount)}</td></tr>`;
  }).join('');

  printWindow.document.write(`
    <html>
      <head>
        <title>Cost Sheet</title>
        <style>
          body { font-family: sans-serif; padding: 2rem; color: #111; }
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          td, th { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
          h1 { margin-bottom: 0.25rem; }
        </style>
      </head>
      <body>
        <h1>Cost Sheet</h1>
        <p>S/N No: ${escapeHtml(costSheet.snNo ?? '—')}</p>
        <table>
          <thead><tr><th>Line</th><th>Amount (LKR)</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p><strong>Total: LKR ${escapeHtml(costSheet.total)}</strong></p>
        <p>Remarks: ${escapeHtml(costSheet.remarks ?? '—')}</p>
        <p>Shift Leader signature: ${escapeHtml(costSheet.shiftLeaderSignature ?? '—')}</p>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

/** PRD §5.3/CONTEXT.md §12: release -> review -> approve. Rendered as one tab pane inside DocumentsSection.tsx's unified tab bar — no card/heading of its own, that's the shared tab container's job. */
export function CostSheetSection({ shipmentId }: { shipmentId: string }) {
  const costSheetQuery = useCostSheet(shipmentId);
  const createMutation = useCreateCostSheet(shipmentId);
  const [confirmingCreate, setConfirmingCreate] = useState(false);

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
        />
      )}
    </div>
  );
}

function CostSheetDetail({ shipmentId, costSheet }: { shipmentId: string; costSheet: CostSheet }) {
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
        costSheet.lines.map((line) => [line.lineType, line.amount ?? '']),
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
        costSheet.lines.map((line) => [line.lineType, line.amount ?? '']),
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
            COST_SHEET_LINE_TYPES.map((type) => [type, lineAmounts[type] || undefined]),
          ) as Record<CostSheetLineType, string | undefined>,
        },
      },
      { onSuccess: () => setIsEditing(false) },
    );
  };

  const fieldsDisabled = !isEditing;

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="bg-muted rounded px-2 py-0.5 text-xs font-medium">{costSheet.status}</span>
        {costSheet.approvedAt && (
          <span className="text-muted-foreground text-xs">
            Approved {new Date(costSheet.approvedAt).toLocaleString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cs-snNo">S/N No</Label>
          <Input
            id="cs-snNo"
            value={snNo}
            disabled={fieldsDisabled}
            onChange={(e) => setSnNo(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {COST_SHEET_LINE_TYPES.map((type) => (
          <div key={type} className="flex flex-col gap-1.5">
            <Label htmlFor={`cs-line-${type}`}>{COST_SHEET_LINE_LABELS[type]}</Label>
            <Input
              id={`cs-line-${type}`}
              inputMode="decimal"
              placeholder="0.00"
              disabled={fieldsDisabled}
              value={lineAmounts[type] ?? ''}
              onChange={(e) => setLineAmounts((prev) => ({ ...prev, [type]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cs-remarks">Remarks</Label>
          <Input
            id="cs-remarks"
            value={remarks}
            disabled={fieldsDisabled}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cs-shiftLeader">Shift Leader signature</Label>
          <Input
            id="cs-shiftLeader"
            value={shiftLeaderSignature}
            disabled={fieldsDisabled}
            onChange={(e) => setShiftLeaderSignature(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <span className="text-lg font-semibold">Total: LKR {costSheet.total}</span>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => printCostSheet(costSheet)}>
            Print
          </Button>

          <RequirePermission permission={editPermission}>
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

          {costSheet.status === 'DRAFT' && (
            <RequirePermission permission="costsheet.prepare">
              <Button
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
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate(costSheet.id)}
              >
                {approveMutation.isPending ? 'Approving…' : 'Approve'}
              </Button>
            </RequirePermission>
          )}
        </div>
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
