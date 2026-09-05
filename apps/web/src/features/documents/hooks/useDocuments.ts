import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocumentType } from '@hub-lanka/shared';
import {
  downloadDocumentFile,
  ensureDraft,
  getLatestDocument,
  getPrintPayload,
  getReadiness,
  issueDocument,
  updateDocumentFields,
} from '@/features/documents/api/documentsApi';

const readinessKey = (shipmentId: string) => ['document-readiness', shipmentId];
const documentKey = (shipmentId: string, type: DocumentType) => ['document', shipmentId, type];

export function useDocumentReadiness(shipmentId: string) {
  return useQuery({ queryKey: readinessKey(shipmentId), queryFn: () => getReadiness(shipmentId) });
}

export function useDocument(shipmentId: string, type: DocumentType, enabled: boolean) {
  return useQuery({
    queryKey: documentKey(shipmentId, type),
    queryFn: () => getLatestDocument(shipmentId, type),
    retry: false,
    enabled,
  });
}

export function useEnsureDraft(shipmentId: string, type: DocumentType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => ensureDraft(shipmentId, type),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKey(shipmentId, type) }),
  });
}

export function useUpdateDocumentFields(shipmentId: string, type: DocumentType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fieldData: Record<string, unknown>) =>
      updateDocumentFields(shipmentId, type, fieldData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKey(shipmentId, type) }),
  });
}

export function useIssueDocument(shipmentId: string, type: DocumentType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => issueDocument(shipmentId, type),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKey(shipmentId, type) }),
  });
}

export function usePrintDocument(shipmentId: string, type: DocumentType) {
  return useMutation({ mutationFn: () => getPrintPayload(shipmentId, type) });
}

export function useDownloadDocumentFile() {
  return useMutation({ mutationFn: (documentId: string) => downloadDocumentFile(documentId) });
}
