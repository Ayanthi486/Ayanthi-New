import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/** BR-11: cancellation requires a reason and Manager approval; Executive cannot cancel directly. */
export function CancellationRequestModal({
  onSubmit,
  onCancel,
  isSubmitting,
  errorMessage,
}: {
  onSubmit: (reason: string) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  errorMessage?: string;
}) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border-border w-full max-w-md rounded-lg border p-6 shadow-lg">
        <h2 className="font-medium">Request cancellation</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          A Manager must approve this before the shipment is cancelled.
        </p>

        <div className="mt-4 flex flex-col gap-1.5">
          <Label htmlFor="cancellation-reason">Reason</Label>
          <textarea
            id="cancellation-reason"
            className="border-input min-h-24 rounded-md border bg-transparent px-3 py-2 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {errorMessage && <p className="text-destructive mt-2 text-sm">{errorMessage}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" disabled={!trimmed || isSubmitting} onClick={() => onSubmit(trimmed)}>
            {isSubmitting ? 'Submitting…' : 'Submit request'}
          </Button>
        </div>
      </div>
    </div>
  );
}
