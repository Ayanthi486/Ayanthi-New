import { useMutation } from '@tanstack/react-query';
import type { MeResponse } from '@hub-lanka/shared';
import { removeAvatar, updateProfile, uploadAvatar } from '@/features/profile/api/profileApi';
import { useAuthStore } from '@/lib/authStore';

/** Every profile mutation returns the fresh MeResponse — reuse the same
 * setSession the login/bootstrap flow uses, rather than a separate store
 * method, so the header/dropdown/page all re-render off one source. */
function applyMeResponse(me: MeResponse) {
  const accessToken = useAuthStore.getState().accessToken;
  useAuthStore.getState().setSession(accessToken ?? '', me);
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: applyMeResponse,
  });
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: uploadAvatar,
    onSuccess: applyMeResponse,
  });
}

export function useRemoveAvatar() {
  return useMutation({
    mutationFn: removeAvatar,
    onSuccess: applyMeResponse,
  });
}
