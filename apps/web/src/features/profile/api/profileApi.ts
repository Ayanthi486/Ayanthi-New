import type { MeResponse, UpdateProfileRequest } from '@hub-lanka/shared';
import { apiFetch, ApiClientError } from '@/lib/apiClient';
import { useAuthStore } from '@/lib/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export async function updateProfile(input: UpdateProfileRequest): Promise<MeResponse> {
  return apiFetch<MeResponse>('/me', { method: 'PATCH', body: JSON.stringify(input) });
}

export async function uploadAvatar(file: File): Promise<MeResponse> {
  const form = new FormData();
  form.set('avatar', file);
  return apiFetch<MeResponse>('/me/avatar', { method: 'POST', body: form });
}

export async function removeAvatar(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/me/avatar', { method: 'DELETE' });
}

/** ARCHITECTURE §12: served only through an authenticated request — never a plain <img src>. */
export async function downloadAvatar(): Promise<Blob> {
  const accessToken = useAuthStore.getState().accessToken;
  const response = await fetch(`${API_BASE_URL}/me/avatar`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!response.ok) {
    throw new ApiClientError('Unable to load the profile photo.', 'AVATAR_ERROR', response.status);
  }
  return response.blob();
}

export async function uploadSignature(file: File): Promise<MeResponse> {
  const form = new FormData();
  form.set('signature', file);
  return apiFetch<MeResponse>('/me/signature', { method: 'POST', body: form });
}

export async function removeSignature(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/me/signature', { method: 'DELETE' });
}

export async function downloadSignature(): Promise<Blob> {
  const accessToken = useAuthStore.getState().accessToken;
  const response = await fetch(`${API_BASE_URL}/me/signature`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!response.ok) {
    throw new ApiClientError('Unable to load the signature.', 'SIGNATURE_ERROR', response.status);
  }
  return response.blob();
}
