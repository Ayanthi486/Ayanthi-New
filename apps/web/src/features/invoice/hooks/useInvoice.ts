import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateInvoiceRequest, UpdateInvoiceRequest } from '@hub-lanka/shared';
import {
  createInvoice,
  getInvoiceByShipmentId,
  issueInvoice,
  updateInvoice,
} from '@/features/invoice/api/invoiceApi';

const invoiceKey = (shipmentId: string) => ['invoice', shipmentId];

export function useInvoice(shipmentId: string) {
  return useQuery({
    queryKey: invoiceKey(shipmentId),
    queryFn: () => getInvoiceByShipmentId(shipmentId),
    retry: false,
  });
}

export function useCreateInvoice(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceRequest) => createInvoice(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invoiceKey(shipmentId) }),
  });
}

export function useUpdateInvoice(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateInvoiceRequest }) =>
      updateInvoice(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invoiceKey(shipmentId) }),
  });
}

export function useIssueInvoice(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    // A fresh key per attempt is correct here — a genuinely new user click is a
    // new attempt, not a replay; React Query's own retry (not used here) or a
    // double-submit from one click is what the key protects against, and the
    // component only ever calls this once per click with one generated key.
    mutationFn: ({ id, idempotencyKey }: { id: string; idempotencyKey: string }) =>
      issueInvoice(id, idempotencyKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invoiceKey(shipmentId) }),
  });
}
