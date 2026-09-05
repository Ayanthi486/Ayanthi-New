import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  downloadReceipt,
  getPaymentsByInvoiceId,
  recordPayment,
  type RecordPaymentInput,
} from '@/features/payment/api/paymentApi';

const paymentsKey = (invoiceId: string) => ['payments', invoiceId];

export function usePayments(invoiceId: string) {
  return useQuery({
    queryKey: paymentsKey(invoiceId),
    queryFn: () => getPaymentsByInvoiceId(invoiceId),
    retry: false,
  });
}

export function useRecordPayment(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: RecordPaymentInput;
      idempotencyKey: string;
    }) => recordPayment(invoiceId, input, idempotencyKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: paymentsKey(invoiceId) }),
  });
}

export function useDownloadReceipt() {
  return useMutation({
    mutationFn: (paymentId: string) => downloadReceipt(paymentId),
  });
}
