/** BR-10: a Completed shipment is locked against normal editing. */
export function LockedBanner() {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      This shipment is Completed and locked against editing or deletion.
    </div>
  );
}
