import type { CutoffAlert, Shipment } from '@hub-lanka/shared';
import { RequirePermission } from '@/app/RequirePermission';
import { Button } from '@/components/ui/button';
import { useAcknowledgeCutoffAlert } from '@/features/cutoff/hooks/useCutoff';
import { useNow } from '@/features/cutoff/hooks/useNow';
import { formatCountdown, scheduledDepartureInstant } from '@/features/cutoff/lib/cutoffTime';
import { cn } from '@/lib/utils';

const STATE_STYLES: Record<'APPROACHING' | 'URGENT' | 'PASSED', string> = {
  APPROACHING: 'bg-amber-100 text-amber-800',
  URGENT: 'bg-red-100 text-red-800',
  PASSED: 'bg-gray-200 text-gray-600',
};

const STATE_LABELS: Record<'APPROACHING' | 'URGENT' | 'PASSED', string> = {
  APPROACHING: 'Approaching',
  URGENT: 'Urgent',
  PASSED: 'Passed',
};

/**
 * Cut-off badge/countdown/acknowledge for one schedule row (PRD §5.5, BR-21/BR-50).
 * Normal renders nothing — absence of an alert IS the Normal state (decision #1).
 * Passed is derived client-side from `shipment.actualDepartureAt`, not from the
 * active-alerts list (the backend's `/cutoff/active` deliberately excludes PASSED
 * rows — GET /cutoff/active only feeds Approaching/Urgent).
 */
export function CutoffIndicator({
  shipment,
  alert,
}: {
  shipment: Shipment;
  alert: CutoffAlert | undefined;
}) {
  const now = useNow();
  const acknowledgeMutation = useAcknowledgeCutoffAlert();

  if (shipment.actualDepartureAt !== null) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
          STATE_STYLES.PASSED,
        )}
      >
        {STATE_LABELS.PASSED}
      </span>
    );
  }

  if (!alert) return null;

  const scheduledDeparture = scheduledDepartureInstant(shipment.flightDate, shipment.depTime);

  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
          STATE_STYLES[alert.state as 'APPROACHING' | 'URGENT'],
        )}
      >
        {STATE_LABELS[alert.state as 'APPROACHING' | 'URGENT']}
      </span>
      <span className="text-muted-foreground text-xs">
        {formatCountdown(scheduledDeparture, now)}
      </span>
      {alert.acknowledgedAt === null && (
        <RequirePermission permission="cutoff.acknowledge">
          <Button
            variant="outline"
            size="sm"
            disabled={acknowledgeMutation.isPending}
            onClick={() => acknowledgeMutation.mutate(shipment.id)}
          >
            Acknowledge
          </Button>
        </RequirePermission>
      )}
    </div>
  );
}
