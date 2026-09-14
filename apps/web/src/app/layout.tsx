import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AppHeader } from '@/components/shared/AppHeader';
import { Toast } from '@/components/shared/Toast';

/** Shared shell for every authenticated screen — see AppHeader for nav. */
export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="w-full flex-1 px-6 py-8"
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <footer className="border-border text-muted-foreground print:hidden border-t px-6 py-4 text-xs">
        Hub Lanka Pvt Limited — internal operations system
      </footer>
      <Toast />
    </div>
  );
}
