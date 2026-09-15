const fs = require('fs');

// 1. profileApi.ts
let apiFile = fs.readFileSync('apps/web/src/features/profile/api/profileApi.ts', 'utf8');
apiFile += `
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
  const response = await fetch(\`\${API_BASE_URL}/me/signature\`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: \`Bearer \${accessToken}\` } : {},
  });
  if (!response.ok) {
    throw new ApiClientError('Unable to load the signature.', 'SIGNATURE_ERROR', response.status);
  }
  return response.blob();
}
`;
fs.writeFileSync('apps/web/src/features/profile/api/profileApi.ts', apiFile);

// 2. useProfile.ts
let hookFile = fs.readFileSync('apps/web/src/features/profile/hooks/useProfile.ts', 'utf8');
hookFile = hookFile.replace(
  `import { removeAvatar, updateProfile, uploadAvatar } from '@/features/profile/api/profileApi';`,
  `import { removeAvatar, updateProfile, uploadAvatar, removeSignature, uploadSignature } from '@/features/profile/api/profileApi';`
);
hookFile += `
export function useUploadSignature() {
  return useMutation({
    mutationFn: uploadSignature,
    onSuccess: applyMeResponse,
  });
}

export function useRemoveSignature() {
  return useMutation({
    mutationFn: removeSignature,
    onSuccess: applyMeResponse,
  });
}
`;
fs.writeFileSync('apps/web/src/features/profile/hooks/useProfile.ts', hookFile);
