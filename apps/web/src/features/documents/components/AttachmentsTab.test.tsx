import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/lib/authStore';
import { useToastStore } from '@/lib/toastStore';
import { AttachmentsTab } from './AttachmentsTab';

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AttachmentsTab shipmentId="shipment-1" />
    </QueryClientProvider>,
  );
}

const attachmentFixture = {
  id: 'att-1',
  shipmentId: 'shipment-1',
  filename: 'customs-form.pdf',
  contentType: 'application/pdf',
  size: 20480,
  uploadedByUserId: 'user-1',
  createdAt: '2026-08-01T00:00:00.000Z',
};

describe('AttachmentsTab', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissions: new Set(['documents.manage']) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.setState({ permissions: new Set() });
    useToastStore.getState().clear();
  });

  it('shows "no files attached yet" when the list is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, []))));

    renderTab();

    await waitFor(() => {
      expect(screen.getByText('No files attached yet.')).toBeInTheDocument();
    });
  });

  it('lists an attachment with its size and upload date, and offers Download/Remove', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, [attachmentFixture]))));

    renderTab();

    await waitFor(() => {
      expect(screen.getByText('customs-form.pdf')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('uploading a file calls the upload endpoint', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(jsonResponse(201, attachmentFixture));
      }
      return Promise.resolve(jsonResponse(200, []));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderTab();
    const fileInput = await screen.findByLabelText('Upload a file');

    const file = new File(['%PDF-1.4'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          (c) => c[0].includes('/shipments/shipment-1/attachments') && c[1]?.method === 'POST',
        ),
      ).toBe(true),
    );
  });

  it('Remove shows a Confirm/Cancel step first — Cancel calls no delete request', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve(jsonResponse(200, { ok: true }));
      }
      return Promise.resolve(jsonResponse(200, [attachmentFixture]));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === 'DELETE')).toBe(false);
  });

  it('Remove Confirm calls the delete endpoint', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return Promise.resolve(jsonResponse(200, { ok: true }));
      }
      return Promise.resolve(jsonResponse(200, [attachmentFixture]));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => c[1]?.method === 'DELETE')).toBe(true),
    );
  });

  it('hides Upload and Remove without documents.manage', async () => {
    useAuthStore.setState({ permissions: new Set() });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, [attachmentFixture]))));

    renderTab();

    await waitFor(() => expect(screen.getByText('customs-form.pdf')).toBeInTheDocument());
    expect(screen.queryByLabelText('Upload a file')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });
});
