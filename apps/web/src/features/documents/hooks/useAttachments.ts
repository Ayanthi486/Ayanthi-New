import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteAttachment,
  downloadAttachment,
  listAttachments,
  uploadAttachment,
} from '@/features/documents/api/attachmentsApi';

const attachmentsKey = (shipmentId: string) => ['attachments', shipmentId];

export function useAttachments(shipmentId: string) {
  return useQuery({
    queryKey: attachmentsKey(shipmentId),
    queryFn: () => listAttachments(shipmentId),
  });
}

export function useUploadAttachment(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadAttachment(shipmentId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attachmentsKey(shipmentId) }),
  });
}

export function useDeleteAttachment(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAttachment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: attachmentsKey(shipmentId) }),
  });
}

export function useDownloadAttachment() {
  return useMutation({ mutationFn: (id: string) => downloadAttachment(id) });
}
