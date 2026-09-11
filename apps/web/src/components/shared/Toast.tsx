import { useEffect } from 'react';
import { useToastStore } from '@/lib/toastStore';

const AUTO_DISMISS_MS = 2500;

/** Mounted once in AppLayout; renders whatever useToastStore currently holds. */
export function Toast() {
  const message = useToastStore((state) => state.message);
  const clear = useToastStore((state) => state.clear);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(clear, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, clear]);

  if (!message) return null;

  return (
    <div
      role="status"
      className="bg-foreground text-background fixed right-4 bottom-4 z-50 rounded-md px-4 py-2 text-sm shadow-lg print:hidden"
    >
      {message}
    </div>
  );
}
