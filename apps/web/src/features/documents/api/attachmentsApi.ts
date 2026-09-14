import type { ShipmentAttachment } from '@hub-lanka/shared';
import { apiFetch, ApiClientError } from '@/lib/apiClient';
import { useAuthStore } from '@/lib/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export async function listAttachments(shipmentId: string): Promise<ShipmentAttachment[]> {
  return apiFetch<ShipmentAttachment[]>(`/shipments/${shipmentId}/attachments`);
}

/** multipart/form-data — apiClient's rawFetch skips the JSON Content-Type for a FormData body. */
export async function uploadAttachment(
  shipmentId: string,
  file: File,
  category: string,
): Promise<ShipmentAttachment> {
  const form = new FormData();
  form.set('file', file);
  form.set('category', category);
  return apiFetch<ShipmentAttachment>(`/shipments/${shipmentId}/attachments`, {
    method: 'POST',
    body: form,
  });
}

export async function deleteAttachment(id: string): Promise<void> {
  await apiFetch<{ ok: true }>(`/attachments/${id}`, { method: 'DELETE' });
}

/** ARCHITECTURE §12: served only through an authenticated, permission-checked endpoint. */
export async function downloadAttachment(id: string): Promise<Blob> {
  const accessToken = useAuthStore.getState().accessToken;
  const response = await fetch(`${API_BASE_URL}/attachments/${id}/file`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!response.ok) {
    throw new ApiClientError(
      'Unable to download this attachment.',
      'ATTACHMENT_FILE_ERROR',
      response.status,
    );
  }
  return response.blob();
}
