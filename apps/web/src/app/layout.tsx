import type { ReactNode } from 'react';
import { AppHeader } from '@/components/shared/AppHeader';
import { Toast } from '@/components/shared/Toast';

/** Shared shell for every authenticated screen — see AppHeader for nav. */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <main className="w-full flex-1 px-6 py-8">{children}</main>
      <footer className="border-border text-muted-foreground print:hidden border-t px-6 py-4 text-xs">
        Hub Lanka Pvt Limited — internal operations system
      </footer>
      <Toast />
    </div>
  );
}
