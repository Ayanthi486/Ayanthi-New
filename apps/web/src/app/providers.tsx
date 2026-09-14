import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { fetchMe } from '@/features/auth/api/authApi';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/lib/authStore';
import { ThemeProvider } from '@/components/shared/ThemeProvider';

/**
 * Runs once on mount: tries GET /me. With no in-memory access token yet
 * (e.g. after a hard reload) this 401s, apiClient's single silent-refresh
 * retry uses the httpOnly refresh cookie to mint a fresh one, and the
 * retried /me populates the session. No refresh cookie (never logged in,
 * or it expired) leaves the user logged out, same as today.
 */
function AuthBootstrap({ children }: { children: ReactNode }) {
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    let cancelled = false;

    fetchMe()
      .then((user) => {
        if (cancelled) return;
        const accessToken = useAuthStore.getState().accessToken;
        setSession(accessToken ?? '', user);
      })
      .catch(() => {
        if (!cancelled) clearSession();
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount only
  }, []);

  if (isLoading) {
    return null;
  }

  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="hlffms-theme">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthBootstrap>{children}</AuthBootstrap>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
