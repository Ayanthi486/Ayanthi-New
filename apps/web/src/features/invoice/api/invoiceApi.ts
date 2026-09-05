import type { CreateInvoiceRequest, Invoice, UpdateInvoiceRequest } from '@hub-lanka/shared';
import { apiFetch } from '@/lib/apiClient';

export async function getInvoiceByShipmentId(shipmentId: string): Promise<Invoice> {
  return apiFetch<Invoice>(`/invoices/by-shipment/${shipmentId}`);
}

export async function createInvoice(input: CreateInvoiceRequest): Promise<Invoice> {
  return apiFetch<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateInvoice(id: string, input: UpdateInvoiceRequest): Promise<Invoice> {
  return apiFetch<Invoice>(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

/** ARCHITECTURE §7: Idempotency-Key honoured on invoice issue — the double-click that creates two invoices is a real incident. */
export async function issueInvoice(id: string, idempotencyKey: string): Promise<Invoice> {
  return apiFetch<Invoice>(`/invoices/${id}/issue`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}
