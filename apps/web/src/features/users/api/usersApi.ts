import type { AdminRole, AdminUser, CreateUserRequest, UpdateUserRequest } from '@hub-lanka/shared';
import { apiFetch } from '@/lib/apiClient';

export async function listUsers(): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>('/users');
}

export async function createUser(input: CreateUserRequest): Promise<AdminUser> {
  return apiFetch<AdminUser>('/users', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateUser(id: string, input: UpdateUserRequest): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function listRoles(): Promise<AdminRole[]> {
  return apiFetch<AdminRole[]>('/roles');
}
