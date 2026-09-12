import type { DocumentReadiness, DocumentType, ShipmentDocument } from '@hub-lanka/shared';
import { apiFetch, ApiClientError } from '@/lib/apiClient';
import { useAuthStore } from '@/lib/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export async function getReadiness(shipmentId: string): Promise<DocumentReadiness> {
  return apiFetch<DocumentReadiness>(`/shipments/${shipmentId}/documents/readiness`);
}

export async function ensureDraft(
  shipmentId: string,
  type: DocumentType,
): Promise<ShipmentDocument> {
  return apiFetch<ShipmentDocument>(`/shipments/${shipmentId}/documents/${type}`, {
    method: 'POST',
  });
}

export async function getLatestDocument(
  shipmentId: string,
  type: DocumentType,
): Promise<ShipmentDocument> {
  return apiFetch<ShipmentDocument>(`/shipments/${shipmentId}/documents/${type}`);
}

export async function updateDocumentFields(
  shipmentId: string,
  type: DocumentType,
  fieldData: Record<string, unknown>,
): Promise<ShipmentDocument> {
  return apiFetch<ShipmentDocument>(`/shipments/${shipmentId}/documents/${type}`, {
    method: 'PATCH',
    body: JSON.stringify({ fieldData }),
  });
}

/** multipart/form-data — apiClient's rawFetch skips the JSON Content-Type for a FormData body. */
export async function uploadDocumentFile(
  shipmentId: string,
  type: DocumentType,
  file: File,
): Promise<ShipmentDocument> {
  const form = new FormData();
  form.set('file', file);
  return apiFetch<ShipmentDocument>(`/shipments/${shipmentId}/documents/${type}/upload`, {
    method: 'POST',
    body: form,
  });
}

export async function issueDocument(
  shipmentId: string,
  type: DocumentType,
): Promise<ShipmentDocument> {
  return apiFetch<ShipmentDocument>(`/shipments/${shipmentId}/documents/${type}/issue`, {
    method: 'POST',
  });
}

export async function getPrintPayload(
  shipmentId: string,
  type: DocumentType,
): Promise<{ html: string; pageSize: string }> {
  return apiFetch(`/shipments/${shipmentId}/documents/${type}/print`);
}

/** ARCHITECTURE §12: served only through an authenticated, permission-checked endpoint. */
export async function downloadDocumentFile(documentId: string): Promise<Blob> {
  const accessToken = useAuthStore.getState().accessToken;
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/file`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!response.ok) {
    throw new ApiClientError(
      'Unable to download the document.',
      'DOCUMENT_FILE_ERROR',
      response.status,
    );
  }
  return response.blob();
}
