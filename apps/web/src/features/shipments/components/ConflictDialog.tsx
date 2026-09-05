import { Button } from '@/components/ui/button';

/**
 * Shown on a 409 (ARCHITECTURE §20). The only safe recovery is reloading
 * the latest server state before retrying — never silently overwrite
 * another user's edit.
 */
export function ConflictDialog({
  onReload,
  onDismiss,
}: {
  onReload: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border-border w-full max-w-sm rounded-lg border p-6 shadow-lg">
        <h2 className="font-medium">Update conflict</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          This shipment was updated by another user. Please review the latest information before
          saving.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
          <Button size="sm" onClick={onReload}>
            Reload latest
          </Button>
        </div>
      </div>
    </div>
  );
}
