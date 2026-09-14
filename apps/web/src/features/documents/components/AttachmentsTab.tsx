import { useState, type ChangeEvent } from 'react';
import type { ShipmentAttachment } from '@hub-lanka/shared';
import { RequirePermission } from '@/app/RequirePermission';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  useAttachments,
  useDeleteAttachment,
  useDownloadAttachment,
  useUploadAttachment,
} from '@/features/documents/hooks/useAttachments';
import { ApiClientError } from '@/lib/apiClient';
import { useToastStore } from '@/lib/toastStore';
import { printFileBlob } from '@/lib/utils';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

/**
 * Free-form supporting files for a shipment (customs forms, correspondence,
 * scans) — any number of them, each independently downloadable/removable.
 * Distinct from the five PRD-defined document tabs: no fieldData/issue
 * workflow, no box/weight readiness gate (see DocumentsSection.tsx).
 */
export function AttachmentsTab({ shipmentId, category, accept, description }: { shipmentId: string; category: string; accept: string; description: string }) {
  const attachmentsQuery = useAttachments(shipmentId);
  const uploadMutation = useUploadAttachment(shipmentId);
  const deleteMutation = useDeleteAttachment(shipmentId);
  const downloadMutation = useDownloadAttachment();
  const showToast = useToastStore((state) => state.show);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);

  const handleFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate({ file, category }, {
      onError: (error) => {
        showToast(
          error instanceof ApiClientError ? error.message : 'Unable to upload this file.',
        );
      },
      // Resets the file input so selecting the same file again still fires onChange.
      onSettled: () => setFileInputKey((key) => key + 1),
    });
  };

  const handleOpen = (attachment: ShipmentAttachment) => {
    downloadMutation.mutate(attachment.id, {
      onSuccess: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      onError: (error) => {
        showToast(error instanceof ApiClientError ? error.message : 'Unable to open this file.');
      },
    });
  };

  const handlePrint = (attachment: ShipmentAttachment) => {
    const printWindow = window.open('about:blank', '_blank');
    downloadMutation.mutate(attachment.id, {
      onSuccess: (blob) => {
        printFileBlob(blob, printWindow);
      },
      onError: (error) => {
        printWindow?.close();
        showToast(error instanceof ApiClientError ? error.message : 'Unable to print this file.');
      },
    });
  };

  const handleRemove = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => setConfirmingRemoveId(null),
      onError: (error) => {
        showToast(error instanceof ApiClientError ? error.message : 'Unable to remove this file.');
      },
    });
  };

  const attachments = (attachmentsQuery.data ?? []).filter(a => a.category === category);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {description}
      </p>

      <RequirePermission permission="documents.manage">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="attachment-upload">Upload a file</Label>
          <input
            key={fileInputKey}
            id="attachment-upload"
            type="file"
            accept={accept}
            disabled={uploadMutation.isPending}
            onChange={handleFileSelected}
            className="text-sm"
          />
        </div>
      </RequirePermission>

      {attachmentsQuery.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {attachmentsQuery.isError && (
        <p className="text-destructive text-sm">Unable to load the attachments.</p>
      )}

      {attachmentsQuery.data && attachments.length === 0 && (
        <p className="text-muted-foreground text-sm">No files attached yet.</p>
      )}

      {attachments.length > 0 && (
        <ul className="divide-border flex flex-col divide-y border-t border-b">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{attachment.filename}</div>
                <div className="text-muted-foreground text-xs">
                  {formatSize(attachment.size)} · {new Date(attachment.createdAt).toLocaleString()}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadMutation.isPending}
                  onClick={() => handlePrint(attachment)}
                >
                  Print
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadMutation.isPending}
                  onClick={() => handleOpen(attachment)}
                >
                  Download
                </Button>

                <RequirePermission permission="documents.manage">
                  {confirmingRemoveId === attachment.id ? (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        onClick={() => handleRemove(attachment.id)}
                      >
                        {deleteMutation.isPending ? 'Removing…' : 'Confirm'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        onClick={() => setConfirmingRemoveId(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmingRemoveId(attachment.id)}
                    >
                      Remove
                    </Button>
                  )}
                </RequirePermission>
              </div>
            </li>
          ))}
        </ul>
      )}

      {uploadMutation.isError && (
        <p className="text-destructive text-sm">
          {uploadMutation.error instanceof ApiClientError
            ? uploadMutation.error.message
            : 'Unable to upload this file.'}
        </p>
      )}
    </div>
  );
}
