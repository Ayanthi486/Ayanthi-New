import { useEffect, useState } from 'react';

/** Ticks the countdown display; not a data source — never used for state-machine decisions (those are server-computed). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
