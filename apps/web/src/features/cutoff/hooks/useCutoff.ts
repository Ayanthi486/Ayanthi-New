import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { acknowledgeCutoffAlert, listActiveCutoffAlerts } from '@/features/cutoff/api/cutoffApi';

export const ACTIVE_CUTOFF_ALERTS_KEY = ['cutoff', 'active'];

// Same cadence as the schedule grid it augments (ARCHITECTURE §3: polling, not WebSockets).
const CUTOFF_POLL_MS = 25_000;

export function useActiveCutoffAlerts() {
  return useQuery({
    queryKey: ACTIVE_CUTOFF_ALERTS_KEY,
    queryFn: listActiveCutoffAlerts,
    refetchInterval: CUTOFF_POLL_MS,
  });
}

export function useAcknowledgeCutoffAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shipmentId: string) => acknowledgeCutoffAlert(shipmentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACTIVE_CUTOFF_ALERTS_KEY }),
  });
}
