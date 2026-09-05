import { useEffect, useState } from 'react';
import { downloadAvatar } from '@/features/profile/api/profileApi';
import { useAuthStore } from '@/lib/authStore';

/**
 * Fetches the current user's own avatar as an authenticated blob (never a
 * plain `<img src="/me/avatar">` — that would send no Authorization header)
 * and exposes it as an object URL, revoked on cleanup. Re-fetches when
 * `hasAvatar` flips or `avatarVersion` bumps (a same-`true` replace/removal
 * still needs a re-fetch — see authStore's doc comment on avatarVersion).
 */
export function useAvatarUrl(hasAvatar: boolean): string | null {
  const avatarVersion = useAuthStore((state) => state.avatarVersion);
  // Only ever holds a fetched-photo URL; the "no photo" case is handled by
  // the `hasAvatar ? fetchedUrl : null` return below rather than a
  // synchronous setState in the effect (react-hooks/set-state-in-effect).
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAvatar) {
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    downloadAvatar()
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setFetchedUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFetchedUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [hasAvatar, avatarVersion]);

  return hasAvatar ? fetchedUrl : null;
}
