import { useState } from 'react';
import {
  DOCUMENT_TYPES,
  ISSUABLE_DOCUMENT_TYPES,
  PDF_DOCUMENT_TYPES,
  type DocumentType,
} from '@hub-lanka/shared';
import { RequirePermission } from '@/app/RequirePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DOCUMENT_TAB_LABELS,
  FIELD_DATA_FIELDS,
  VIEW_MODEL_FIELDS,
} from '@/features/documents/fieldConfig';
import {
  useDocument,
  useDocumentReadiness,
  useDownloadDocumentFile,
  useEnsureDraft,
  useIssueDocument,
  usePrintDocument,
  useUpdateDocumentFields,
} from '@/features/documents/hooks/useDocuments';
import { ApiClientError } from '@/lib/apiClient';
import { useToastStore } from '@/lib/toastStore';
import { cn } from '@/lib/utils';

/** CONTEXT.md §15: five tabs on the Shipment View, all keyed to Shipment ID. */
export function DocumentsSection({ shipmentId }: { shipmentId: string }) {
  const [activeType, setActiveType] = useState<DocumentType>('SECURITY_CLEARANCE');
  const readinessQuery = useDocumentReadiness(shipmentId);

  return (
    <div className="border-border bg-card rounded-lg border p-6">
      <h2 className="font-medium">Documents</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Security Clearance · AWB Sticker · ADF · AWB · CDN (PRD §9).
      </p>

      <div className="mt-4 flex flex-wrap gap-1 border-b">
        {DOCUMENT_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveType(type)}
            className={`rounded-t px-3 py-1.5 text-sm ${
              activeType === type
                ? 'border-primary text-foreground border-b-2 font-medium'
                : 'text-muted-foreground'
            }`}
          >
            {DOCUMENT_TAB_LABELS[type]}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {readinessQuery.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {readinessQuery.data && !readinessQuery.data.ready && (
          // BR-07: the exact confirmed message, never reworded.
          <p className="text-destructive text-sm">
            Cannot generate document. Please enter Box and Weight information.
          </p>
        )}
        {readinessQuery.data?.ready && (
          <DocumentTab key={activeType} shipmentId={shipmentId} type={activeType} />
        )}
      </div>
    </div>
  );
}

function DocumentTab({ shipmentId, type }: { shipmentId: string; type: DocumentType }) {
  const documentQuery = useDocument(shipmentId, type, true);
  const ensureDraftMutation = useEnsureDraft(shipmentId, type);

  const notFound =
    documentQuery.isError &&
    documentQuery.error instanceof ApiClientError &&
    documentQuery.error.status === 404;

  return (
    <div>
      {documentQuery.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {notFound && (
        <RequirePermission permission="documents.manage">
          <Button
            disabled={ensureDraftMutation.isPending}
            onClick={() => ensureDraftMutation.mutate()}
          >
            {ensureDraftMutation.isPending ? 'Creating…' : `Create ${DOCUMENT_TAB_LABELS[type]}`}
          </Button>
        </RequirePermission>
      )}

      {documentQuery.isError && !notFound && (
        <p className="text-destructive text-sm">Unable to load this document.</p>
      )}

      {documentQuery.data && (
        <DocumentDetail
          key={`${documentQuery.data.version}-${documentQuery.data.status}`}
          shipmentId={shipmentId}
          type={type}
          document={documentQuery.data}
        />
      )}
    </div>
  );
}

const STATUS_STYLES: Record<'DRAFT' | 'ISSUED', string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  ISSUED: 'bg-green-100 text-green-800',
};

/**
 * Opens a blank, same-origin window synchronously (inside the click
 * handler) and fills it in once the print HTML arrives. `window.open`
 * called from inside an async callback (i.e. after the mutation's fetch
 * resolves) loses the browser's "was this a direct user gesture?" check and
 * gets silently popup-blocked — `printWindow.document.write`, by contrast,
 * is a same-origin DOM write with no such requirement, so it's safe to do
 * once the fetch resolves as long as the window itself opened up front.
 */
function openPreparingWindow(): Window | null {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  printWindow?.document.write(
    '<p style="font-family:sans-serif;padding:2rem;color:#555;">Preparing document…</p>',
  );
  return printWindow;
}

function DocumentDetail({
  shipmentId,
  type,
  document,
}: {
  shipmentId: string;
  type: DocumentType;
  document: import('@hub-lanka/shared').ShipmentDocument;
}) {
  const updateMutation = useUpdateDocumentFields(shipmentId, type);
  const issueMutation = useIssueDocument(shipmentId, type);
  const printMutation = usePrintDocument(shipmentId, type);
  const previewMutation = usePrintDocument(shipmentId, type);
  const downloadMutation = useDownloadDocumentFile();
  const showToast = useToastStore((state) => state.show);

  const [fieldData, setFieldData] = useState<Record<string, string>>(
    () => document.fieldData as Record<string, string>,
  );
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const isIssued = document.status === 'ISSUED';
  const isIssuable = (ISSUABLE_DOCUMENT_TYPES as readonly DocumentType[]).includes(type);
  const isPdfType = (PDF_DOCUMENT_TYPES as readonly DocumentType[]).includes(type);
  // BR-63: the only type with no rendered output at all — no Preview, no Print.
  const hasRenderedOutput = type !== 'ADF';
  const printLabel = type === 'AWB_STICKER' ? 'Print Sticker' : 'Print';

  const handleSave = () => {
    updateMutation.mutate(fieldData, {
      onError: (error) => {
        const message =
          error instanceof ApiClientError ? error.message : 'Unable to save this document.';
        showToast(message);
      },
    });
  };

  const handlePreview = () => {
    if (previewHtml !== null) {
      setPreviewHtml(null);
      return;
    }
    previewMutation.mutate(undefined, {
      onSuccess: ({ html }) => setPreviewHtml(html),
      onError: (error) => {
        const message =
          error instanceof ApiClientError ? error.message : 'Unable to preview this document.';
        showToast(message);
      },
    });
  };

  const handlePrint = () => {
    const printWindow = openPreparingWindow();
    if (!printWindow) {
      showToast('Pop-up blocked — please allow pop-ups for this site, then try Print again.');
      return;
    }
    printMutation.mutate(undefined, {
      onSuccess: ({ html }) => {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      },
      onError: (error) => {
        printWindow.close();
        const message =
          error instanceof ApiClientError
            ? error.message
            : 'Unable to prepare this document for printing.';
        showToast(message);
      },
    });
  };

  const handleDownload = () => {
    downloadMutation.mutate(document.id, {
      onSuccess: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      onError: (error) => {
        const message =
          error instanceof ApiClientError ? error.message : 'Unable to download this document.';
        showToast(message);
      },
    });
  };

  const handleIssue = () => {
    issueMutation.mutate(undefined, {
      onSuccess: () => showToast(`${DOCUMENT_TAB_LABELS[type]} issued.`),
      onError: (error) => {
        const message =
          error instanceof ApiClientError ? error.message : 'Unable to issue this document.';
        showToast(message);
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn('rounded px-2 py-0.5 text-xs font-medium', STATUS_STYLES[document.status])}
        >
          {document.status} · v{document.version}
        </span>
        {document.issuedAt && (
          <span className="text-muted-foreground text-xs">
            Issued {new Date(document.issuedAt).toLocaleString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {VIEW_MODEL_FIELDS[type].map((field) => (
          <div key={field.key}>
            <div className="text-muted-foreground text-xs">{field.label}</div>
            <div className="text-sm">{formatViewModelValue(document.viewModel[field.key])}</div>
          </div>
        ))}
      </div>

      {FIELD_DATA_FIELDS[type].length > 0 && (
        <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-3">
          {FIELD_DATA_FIELDS[type].map((field) => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <Label htmlFor={`doc-${type}-${field.key}`}>{field.label}</Label>
              <Input
                id={`doc-${type}-${field.key}`}
                value={fieldData[field.key] ?? ''}
                disabled={isIssued}
                onChange={(e) => setFieldData((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-4">
        {!isIssued && (
          <RequirePermission permission="documents.manage">
            <Button variant="outline" disabled={updateMutation.isPending} onClick={handleSave}>
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </RequirePermission>
        )}

        {hasRenderedOutput && (
          <Button variant="outline" disabled={previewMutation.isPending} onClick={handlePreview}>
            {previewMutation.isPending
              ? 'Loading…'
              : previewHtml !== null
                ? 'Hide Preview'
                : 'Preview'}
          </Button>
        )}

        {hasRenderedOutput && (
          <Button variant="outline" disabled={printMutation.isPending} onClick={handlePrint}>
            {printMutation.isPending ? 'Preparing…' : printLabel}
          </Button>
        )}

        {isIssuable && !isIssued && (
          <RequirePermission permission="documents.manage">
            <Button disabled={issueMutation.isPending} onClick={handleIssue}>
              {issueMutation.isPending ? 'Issuing…' : 'Issue'}
            </Button>
          </RequirePermission>
        )}

        {isPdfType && isIssued && document.hasStoredFile && (
          <Button variant="outline" disabled={downloadMutation.isPending} onClick={handleDownload}>
            {downloadMutation.isPending ? 'Downloading…' : 'Download'}
          </Button>
        )}
      </div>

      {previewHtml !== null && (
        <iframe
          title={`${DOCUMENT_TAB_LABELS[type]} preview`}
          srcDoc={previewHtml}
          className="border-border h-[32rem] w-full rounded border bg-white"
        />
      )}

      {(updateMutation.isError || issueMutation.isError) && (
        <p className="text-destructive text-sm">
          {[updateMutation.error, issueMutation.error]
            .filter((e): e is ApiClientError => e instanceof ApiClientError)
            .map((e) => e.message)[0] ?? 'Unable to save the document.'}
        </p>
      )}
    </div>
  );
}

/** Every view-model value is a string, number or null (documents.util.ts's buildShipmentViewModel). */
function formatViewModelValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '—';
}
