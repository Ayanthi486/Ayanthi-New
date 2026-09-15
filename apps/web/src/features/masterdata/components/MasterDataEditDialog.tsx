import { useEffect } from 'react';
import { useForm, type FieldValues, type Resolver } from 'react-hook-form';
import type { UseMutationResult } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ApiClientError } from '@/lib/apiClient';

interface MasterDataEditDialogProps<TRow, TCreate extends FieldValues> {
  row: TRow;
  resolver: Resolver<TCreate>;
  renderCreateFields: (register: ReturnType<typeof useForm<TCreate>>['register']) => React.ReactNode;
  useUpdate: () => UseMutationResult<TRow, unknown, { id: string; input: TCreate }>;
  onClose: () => void;
}

export function MasterDataEditDialog<TRow extends { id: string }, TCreate extends FieldValues>({
  row,
  resolver,
  renderCreateFields,
  useUpdate,
  onClose,
}: MasterDataEditDialogProps<TRow, TCreate>) {
  const updateMutation = useUpdate();
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TCreate>({
    resolver,
    defaultValues: row as any, // Initialize with current row data
  });

  useEffect(() => {
    reset(row as any);
  }, [row, reset]);

  const onSubmit = handleSubmit((values) => {
    updateMutation.mutate({ id: row.id, input: values }, { onSuccess: () => onClose() });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="bg-card w-full max-w-lg flex flex-col gap-4 rounded-lg p-6 shadow-xl"
      >
        <h2 className="text-xl font-semibold">Edit Record</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{renderCreateFields(register)}</div>
        {Object.keys(errors).length > 0 && (
          <p className="text-destructive text-xs">Please correct the highlighted fields.</p>
        )}
        {updateMutation.isError && (
          <p className="text-destructive text-sm">
            {updateMutation.error instanceof ApiClientError
              ? updateMutation.error.message
              : 'Unable to update the record.'}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={updateMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  );
}
