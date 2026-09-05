import { useMutation } from '@tanstack/react-query';
import type { LoginRequest } from '@hub-lanka/shared';
import { login } from '@/features/auth/api/authApi';
import { useAuthStore } from '@/lib/authStore';

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: (input: LoginRequest) => login(input),
    onSuccess: (data) => {
      setSession(data.accessToken, data.user);
    },
  });
}
