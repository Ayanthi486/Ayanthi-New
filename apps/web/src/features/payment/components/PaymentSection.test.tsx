import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/lib/authStore';
import { PaymentSection } from './PaymentSection';

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PaymentSection invoiceId="inv-1" />
    </QueryClientProvider>,
  );
}

const listFixture = {
  payments: [
    {
      id: 'pay-1',
      invoiceId: 'inv-1',
      amount: '60.00',
      currency: 'USD',
      paymentDate: '2026-08-20',
      method: 'Bank Transfer',
      reference: 'TXN-1',
      hasReceipt: true,
      recordedByUserId: 'user-1',
      createdAt: '2026-08-20T00:00:00.000Z',
    },
  ],
  summary: { totalUsd: '100.00', paidUsd: '60.00', remainingUsd: '40.00', isFullyPaid: false },
};

describe('PaymentSection', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissions: new Set(['payment.record', 'payment.view']) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.setState({ permissions: new Set() });
  });

  it('shows the payment history, summary and the record form while not fully paid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(200, listFixture))),
    );

    renderSection();

    await waitFor(() => {
      expect(screen.getByText('40.00')).toBeInTheDocument();
    });
    expect(screen.getByText('60.00 USD')).toBeInTheDocument();
    expect(screen.getByText('PARTIALLY PAID')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record Payment' })).toBeInTheDocument();
  });

  it('hides the record form once fully paid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(200, {
            ...listFixture,
            summary: {
              totalUsd: '100.00',
              paidUsd: '100.00',
              remainingUsd: '0.00',
              isFullyPaid: true,
            },
          }),
        ),
      ),
    );

    renderSection();

    await waitFor(() => {
      expect(screen.getByText('FULLY PAID')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Record Payment' })).not.toBeInTheDocument();
  });

  it('submits a multipart record request with the entered fields', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(jsonResponse(201, listFixture.payments[0]));
      }
      return Promise.resolve(jsonResponse(200, listFixture));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderSection();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Record Payment' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '25.00' } });
    fireEvent.change(screen.getByLabelText('Payment Date'), { target: { value: '2026-08-21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
      expect(postCall).toBeDefined();
      const [url, init] = postCall as [string, RequestInit];
      expect(url).toContain('/invoices/inv-1/payments');
      expect(init.body).toBeInstanceOf(FormData);
    });
  });
});
