import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  ISSUABLE_DOCUMENT_TYPES,
  PDF_DOCUMENT_TYPES,
  UPLOAD_DOCUMENT_TYPES,
  type DocumentType,
  type PermissionKey,
  type ShipmentDocument,
} from '@hub-lanka/shared';
import { RequirePermission } from '@/app/RequirePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CostSheetSection } from '@/features/costsheet/components/CostSheetSection';
import { AttachmentsTab } from '@/features/documents/components/AttachmentsTab';
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
  useUploadDocumentFile,
} from '@/features/documents/hooks/useDocuments';
import { InvoiceSection } from '@/features/invoice/components/InvoiceSection';
import { ApiClientError } from '@/lib/apiClient';
import { useAuthStore } from '@/lib/authStore';
import { useToastStore } from '@/lib/toastStore';
import { cn, printFileBlob } from '@/lib/utils';

/** One tab per non-document key, alongside the five PRD §9 document types. */
type ExtraTabKey = 'ATTACHMENTS' | 'COST_SHEET' | 'INVOICE';
type TabKey = DocumentType | ExtraTabKey;

const DOC_VIEW_PERMISSIONS: PermissionKey[] = ['documents.manage', 'documents.view.readonly'];
/** Direct request: Security Clearance/AWB Sticker/CDN are Executive-only — `documents.basic.manage`, held by nobody else, not the broader documents.* keys above. */
const EXECUTIVE_ONLY_PERMISSIONS: PermissionKey[] = ['documents.basic.manage'];

/**
 * Every tab this section can show, in the exact requested order — Security
 * Clearance, AWB Sticker, CDN, Cost Sheet, ADF, AWB, Shipment Documents,
 * CUSDEC, Freight Invoice — with Cost Sheet/Invoice folded in alongside the
 * PRD §9 document types instead of sitting in their own separate cards.
 * Each tab is gated on its own permission; a viewer only ever sees the
 * tabs they actually have access to.
 */
const TAB_DEFS: { key: TabKey; label: string; permissions: PermissionKey[] }[] = [
  {
    key: 'SECURITY_CLEARANCE',
    label: 'Security Clearance',
    permissions: EXECUTIVE_ONLY_PERMISSIONS,
  },
  { key: 'AWB_STICKER', label: 'AWB Sticker', permissions: EXECUTIVE_ONLY_PERMISSIONS },
  { key: 'CDN', label: 'CDN', permissions: EXECUTIVE_ONLY_PERMISSIONS },
  { key: 'COST_SHEET', label: 'Cost Sheet', permissions: ['costsheet.view'] },
  { key: 'ADF', label: 'ADF', permissions: DOC_VIEW_PERMISSIONS },
  { key: 'AWB', label: 'AWB', permissions: DOC_VIEW_PERMISSIONS },
  { key: 'ATTACHMENTS', label: 'Shipment Documents', permissions: DOC_VIEW_PERMISSIONS },
  { key: 'CUSDEC', label: 'CUSDEC', permissions: DOC_VIEW_PERMISSIONS },
  { key: 'INVOICE', label: 'Freight Invoice', permissions: ['invoice.view', 'invoice.view.readonly'] },
];

export function DocumentsSection({ shipmentId }: { shipmentId: string }) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const readinessQuery = useDocumentReadiness(shipmentId);
  const [requestedTab, setRequestedTab] = useState<TabKey | null>(null);

  const visibleTabs = useMemo(
    () => TAB_DEFS.filter((tab) => tab.permissions.some((permission) => hasPermission(permission))),
    [hasPermission],
  );

  if (visibleTabs.length === 0) return null;

  const activeTab =
    requestedTab && visibleTabs.some((tab) => tab.key === requestedTab)
      ? requestedTab
      : // Safe: the `visibleTabs.length === 0` case already returned above.
        visibleTabs[0]!.key;

  let content: ReactNode;
  if (activeTab === 'ATTACHMENTS') {
    content = <AttachmentsTab shipmentId={shipmentId} category="OTHER" accept="application/pdf,image/jpeg,image/png" description="Supporting files for this shipment — customs forms, correspondence, scans (PDF, JPEG or PNG)." />;
  } else if (activeTab === 'COST_SHEET') {
    content = <CostSheetSection shipmentId={shipmentId} />;
  } else if (activeTab === 'INVOICE') {
    content = <InvoiceSection shipmentId={shipmentId} />;
  } else if (readinessQuery.isLoading) {
    content = <p className="text-muted-foreground text-sm">Loading…</p>;
  } else if (readinessQuery.data && !readinessQuery.data.ready && !['SECURITY_CLEARANCE', 'CDN'].includes(activeTab)) {
    // BR-07: the exact confirmed message, never reworded.
    content = (
      <p className="text-destructive text-sm">
        Cannot generate document. Please enter Box and Weight information.
      </p>
    );
  } else if (readinessQuery.data) {
    content = (UPLOAD_DOCUMENT_TYPES as readonly DocumentType[]).includes(activeTab) ? (
      <AttachmentsTab key={activeTab} shipmentId={shipmentId} category={activeTab} accept="application/pdf,image/jpeg,image/png" description={`Upload ${DOCUMENT_TAB_LABELS[activeTab as DocumentType]} files and pictures (PDF, JPEG or PNG).`} />
    ) : (
      <DocumentTab key={activeTab} shipmentId={shipmentId} type={activeTab as DocumentType} />
    );
  }

  return (
    <div className="border-border bg-card rounded-lg border p-6">
      <h2 className="font-medium">Documents</h2>

      <div className="bg-muted mt-4 inline-flex flex-wrap gap-1 rounded-lg p-1">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setRequestedTab(tab.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">{content}</div>
    </div>
  );
}

/** ADF, AWB, and CUSDEC: a user-uploaded PDF, not a generated document — upload/replace, Download, Print. No fieldData form, no Issue step. */
function UploadDocumentTab({ shipmentId, type }: { shipmentId: string; type: DocumentType }) {
  const documentQuery = useDocument(shipmentId, type, true);
  const uploadMutation = useUploadDocumentFile(shipmentId, type);
  const downloadMutation = useDownloadDocumentFile();
  const showToast = useToastStore((state) => state.show);
  const [fileInputKey, setFileInputKey] = useState(0);

  const notFound =
    documentQuery.isError &&
    documentQuery.error instanceof ApiClientError &&
    documentQuery.error.status === 404;

  const handleFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(file, {
      onError: (error) => {
        showToast(
          error instanceof ApiClientError ? error.message : 'Unable to upload this document.',
        );
      },
      // Resets the file input so selecting the same file again still fires onChange.
      onSettled: () => setFileInputKey((key) => key + 1),
    });
  };

  const handlePrint = (document: ShipmentDocument) => {
    const printWindow = window.open('about:blank', '_blank');
    downloadMutation.mutate(document.id, {
      onSuccess: (blob) => {
        printFileBlob(blob, printWindow);
      },
      onError: (error) => {
        printWindow?.close();
        showToast(error instanceof ApiClientError ? error.message : 'Unable to print this document.');
      },
    });
  };

  const handleOpen = (document: ShipmentDocument) => {
    downloadMutation.mutate(document.id, {
      onSuccess: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      onError: (error) => {
        showToast(
          error instanceof ApiClientError ? error.message : 'Unable to open this document.',
        );
      },
    });
  };

  if (documentQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }
  if (documentQuery.isError && !notFound) {
    return <p className="text-destructive text-sm">Unable to load this document.</p>;
  }

  const document = documentQuery.data;

  return (
    <div className="flex flex-col gap-4">
      {document ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            {document.status} · v{document.version}
          </span>
          <span className="text-muted-foreground text-xs">
            Uploaded {new Date(document.updatedAt).toLocaleString()}
          </span>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No file has been uploaded yet.</p>
      )}

      <RequirePermission permission="documents.manage">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`doc-upload-${type}`}>
            {document ? 'Replace file (PDF)' : 'Upload file (PDF)'}
          </Label>
          <input
            key={fileInputKey}
            id={`doc-upload-${type}`}
            type="file"
            accept="application/pdf"
            disabled={uploadMutation.isPending}
            onChange={handleFileSelected}
            className="text-sm"
          />
        </div>
      </RequirePermission>

      {document && (
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button
            variant="outline"
            disabled={downloadMutation.isPending}
            onClick={() => handleOpen(document)}
          >
            {downloadMutation.isPending ? 'Opening…' : 'Print'}
          </Button>
          <Button
            variant="outline"
            disabled={downloadMutation.isPending}
            onClick={() => handlePrint(document)}
          >
            {downloadMutation.isPending ? 'Preparing…' : 'Print'}
          </Button>
          <Button
            variant="outline"
            disabled={downloadMutation.isPending}
            onClick={() => handleOpen(document)}
          >
            Download
          </Button>
        </div>
      )}

      {uploadMutation.isError && (
        <p className="text-destructive text-sm">
          {uploadMutation.error instanceof ApiClientError
            ? uploadMutation.error.message
            : 'Unable to upload this document.'}
        </p>
      )}
    </div>
  );
}

function DocumentTab({ shipmentId, type }: { shipmentId: string; type: DocumentType }) {
  const documentQuery = useDocument(shipmentId, type, true);
  const ensureDraftMutation = useEnsureDraft(shipmentId, type);
  const [confirmingCreate, setConfirmingCreate] = useState(false);

  const notFound =
    documentQuery.isError &&
    documentQuery.error instanceof ApiClientError &&
    documentQuery.error.status === 404;

  return (
    <div>
      {documentQuery.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {notFound && (
        // DocumentTab only ever renders for SECURITY_CLEARANCE/AWB_STICKER/CDN
        // (ADF/AWB/CUSDEC route to UploadDocumentTab instead) — all three are
        // Executive-only, gated on documents.basic.manage, not documents.manage.
        <RequirePermission permission="documents.basic.manage">
          {confirmingCreate ? (
            <div className="flex items-center gap-2">
              <span className="text-sm">Create {DOCUMENT_TAB_LABELS[type]}?</span>
              <Button
                disabled={ensureDraftMutation.isPending}
                onClick={() => ensureDraftMutation.mutate()}
              >
                {ensureDraftMutation.isPending ? 'Creating…' : 'Confirm'}
              </Button>
              <Button
                variant="outline"
                disabled={ensureDraftMutation.isPending}
                onClick={() => setConfirmingCreate(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button onClick={() => setConfirmingCreate(true)}>
              {`Create ${DOCUMENT_TAB_LABELS[type]}`}
            </Button>
          )}
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
  return window.open('about:blank', '_blank');
}

function DocumentDetail({
  shipmentId,
  type,
  document,
}: {
  shipmentId: string;
  type: DocumentType;
  document: ShipmentDocument;
}) {
  const updateMutation = useUpdateDocumentFields(shipmentId, type);
  const issueMutation = useIssueDocument(shipmentId, type);
  const printMutation = usePrintDocument(shipmentId, type);
  const previewMutation = usePrintDocument(shipmentId, type);
  const downloadMutation = useDownloadDocumentFile();
  const showToast = useToastStore((state) => state.show);

  const savedFieldData = document.fieldData as Record<string, string>;
  const [fieldData, setFieldData] = useState<Record<string, string>>(savedFieldData);
  const [isEditingFields, setIsEditingFields] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const isIssued = document.status === 'ISSUED';
  const isIssuable = (ISSUABLE_DOCUMENT_TYPES as readonly DocumentType[]).includes(type);
  const isPdfType = (PDF_DOCUMENT_TYPES as readonly DocumentType[]).includes(type);
  const hasFieldData = FIELD_DATA_FIELDS[type].length > 0;
  // BR-63: the only type with no rendered output at all — no Preview, no Print.
  const hasRenderedOutput = !['ADF', 'AWB', 'CUSDEC'].includes(type as string);
  const printLabel = type === 'AWB_STICKER' ? 'Print Sticker' : 'Print';

  const handleEditFields = () => {
    setFieldData(savedFieldData);
    setIsEditingFields(true);
  };

  const handleCancelEditFields = () => {
    setFieldData(savedFieldData);
    setIsEditingFields(false);
  };

  const handleSave = () => {
    updateMutation.mutate(fieldData, {
      onSuccess: () => setIsEditingFields(false),
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
        const fullHtml = html + `<script>window.onload = () => setTimeout(() => { window.print(); }, 200);</script>`;
        const blob = new Blob([fullHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        printWindow.location.href = url;
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

      {hasFieldData && (
        <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-3">
          {FIELD_DATA_FIELDS[type].map((field) => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <Label htmlFor={`doc-${type}-${field.key}`}>{field.label}</Label>
              <Input
                id={`doc-${type}-${field.key}`}
                value={fieldData[field.key] ?? ''}
                disabled={isIssued || !isEditingFields}
                onChange={(e) => setFieldData((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-4">
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

        {!isIssued && hasFieldData && (
          <RequirePermission permission="documents.basic.manage">
            {isEditingFields ? (
              <>
                <Button
                  variant="outline"
                  disabled={updateMutation.isPending}
                  onClick={handleCancelEditFields}
                >
                  Cancel
                </Button>
                <Button disabled={updateMutation.isPending} onClick={handleSave}>
                  {updateMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={handleEditFields}>
                Edit
              </Button>
            )}
          </RequirePermission>
        )}

        {isIssuable && !isIssued && (
          <RequirePermission permission="documents.basic.manage">
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
