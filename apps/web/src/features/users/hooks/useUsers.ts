import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserRequest } from '@hub-lanka/shared';
import { createUser, listRoles, listUsers, updateUser } from '@/features/users/api/usersApi';

const USERS_KEY = ['users'];
const ROLES_KEY = ['roles'];

export function useUsers() {
  return useQuery({ queryKey: USERS_KEY, queryFn: listUsers });
}

export function useRoles() {
  return useQuery({ queryKey: ROLES_KEY, queryFn: listRoles });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserRequest) => createUser(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateUser(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}
