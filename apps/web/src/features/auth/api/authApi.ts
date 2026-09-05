import { type LoginRequest, type LoginResponse, type MeResponse } from '@hub-lanka/shared';
import { apiFetch } from '@/lib/apiClient';

export async function login(input: LoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<void> {
  await apiFetch<void>('/auth/logout', { method: 'POST' });
}

export async function fetchMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/me');
}
