import type { PaymentListResponse, Payment as SharedPayment } from '@hub-lanka/shared';
import { apiFetch, ApiClientError } from '@/lib/apiClient';
import { useAuthStore } from '@/lib/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export async function getPaymentsByInvoiceId(invoiceId: string): Promise<PaymentListResponse> {
  return apiFetch<PaymentListResponse>(`/invoices/${invoiceId}/payments`);
}

export interface RecordPaymentInput {
  amount: string;
  currency: 'USD' | 'LKR';
  paymentDate: string;
  method?: string;
  reference?: string;
  receipt?: File;
}

/** multipart/form-data — apiClient's rawFetch skips the JSON Content-Type for a FormData body. */
export async function recordPayment(
  invoiceId: string,
  input: RecordPaymentInput,
  idempotencyKey: string,
): Promise<SharedPayment> {
  const form = new FormData();
  form.set('amount', input.amount);
  form.set('currency', input.currency);
  form.set('paymentDate', input.paymentDate);
  if (input.method) form.set('method', input.method);
  if (input.reference) form.set('reference', input.reference);
  if (input.receipt) form.set('receipt', input.receipt);

  return apiFetch<SharedPayment>(`/invoices/${invoiceId}/payments`, {
    method: 'POST',
    body: form,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

/** ARCHITECTURE §12: served only through an authenticated, permission-checked endpoint — never a plain link. */
export async function downloadReceipt(
  paymentId: string,
): Promise<{ blob: Blob; contentType: string }> {
  const accessToken = useAuthStore.getState().accessToken;
  const response = await fetch(`${API_BASE_URL}/payments/${paymentId}/receipt`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    const message =
      body && typeof body === 'object' && 'error' in body
        ? ((body as { error?: { message?: string } }).error?.message ??
          'Unable to load the receipt.')
        : 'Unable to load the receipt.';
    throw new ApiClientError(message, 'RECEIPT_ERROR', response.status);
  }
  return { blob: await response.blob(), contentType: response.headers.get('Content-Type') ?? '' };
}
