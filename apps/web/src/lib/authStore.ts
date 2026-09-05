import { create } from 'zustand';
import type { AuthUser } from '@hub-lanka/shared';

interface AuthState {
  user: AuthUser | null;
  permissions: Set<string>;
  accessToken: string | null;
  /** True until the initial GET /me bootstrap (providers.tsx) resolves. */
  isLoading: boolean;
  /**
   * Bumped every time `setSession` runs (login, bootstrap, or a profile
   * update returning a fresh MeResponse). `hasAvatar` alone can't tell a
   * consumer "the photo was replaced" when it was already `true` before and
   * after — this gives useAvatarUrl something that always changes, so it
   * knows to re-fetch the image bytes rather than trust a stale cached one.
   */
  avatarVersion: number;
  setSession: (accessToken: string, user: AuthUser) => void;
  /** Updates just the token — used mid-refresh, before the retried request
   * (which may itself be what populates `user`) has resolved. */
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  setLoading: (loading: boolean) => void;
  hasPermission: (permission: string) => boolean;
}

/**
 * In memory only — no `persist` middleware, no localStorage. The access
 * token must not survive a page reload in storage; a hard reload
 * re-bootstraps via the httpOnly refresh cookie instead (ARCHITECTURE §8).
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  permissions: new Set(),
  accessToken: null,
  isLoading: true,
  avatarVersion: 0,
  setSession: (accessToken, user) =>
    set((state) => ({
      accessToken,
      user,
      permissions: new Set(user.permissions),
      isLoading: false,
      avatarVersion: state.avatarVersion + 1,
    })),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () =>
    set({ accessToken: null, user: null, permissions: new Set(), isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  hasPermission: (permission) => get().permissions.has(permission),
}));
