import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/lib/authStore';
import { useToastStore } from '@/lib/toastStore';
import { DocumentsSection } from './DocumentsSection';

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentsSection shipmentId="shipment-1" />
    </QueryClientProvider>,
  );
}

const stickerFixture = {
  id: 'doc-1',
  shipmentId: 'shipment-1',
  type: 'SECURITY_CLEARANCE',
  version: 1,
  status: 'DRAFT',
  fieldData: {},
  viewModel: { awbNo: '157 0659 8944', shipperName: 'OCEAN LINE SEA FOODS PVT LTD' },
  hasStoredFile: false,
  createdByUserId: 'user-1',
  issuedByUserId: null,
  issuedAt: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

describe('DocumentsSection', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissions: new Set(['documents.manage']) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.setState({ permissions: new Set() });
    useToastStore.getState().clear();
  });

  it('shows the exact confirmed blocked message when BOX/WEIGHT are missing (BR-07)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/readiness')) {
          return Promise.resolve(
            jsonResponse(200, { ready: false, missingFields: ['boxCount', 'weightKg'] }),
          );
        }
        return Promise.resolve(
          jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'not found' } }),
        );
      }),
    );

    renderSection();

    await waitFor(() => {
      expect(
        screen.getByText('Cannot generate document. Please enter Box and Weight information.'),
      ).toBeInTheDocument();
    });
  });

  it('shows the Create action for the active tab once ready and not yet created', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/readiness'))
          return Promise.resolve(jsonResponse(200, { ready: true, missingFields: [] }));
        return Promise.resolve(
          jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'not found' } }),
        );
      }),
    );

    renderSection();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create Security Clearance' })).toBeInTheDocument();
    });
  });

  it('shows the populated view model and Issue action for an existing DRAFT', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/readiness'))
          return Promise.resolve(jsonResponse(200, { ready: true, missingFields: [] }));
        return Promise.resolve(jsonResponse(200, stickerFixture));
      }),
    );

    renderSection();

    await waitFor(() => {
      expect(screen.getByText('157 0659 8944')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Issue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
  });

  it('switches tabs and fetches the ADF with no Print action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/readiness'))
          return Promise.resolve(jsonResponse(200, { ready: true, missingFields: [] }));
        if (url.includes('/documents/ADF')) {
          return Promise.resolve(
            jsonResponse(200, { ...stickerFixture, id: 'doc-2', type: 'ADF' }),
          );
        }
        return Promise.resolve(jsonResponse(200, stickerFixture));
      }),
    );

    renderSection();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Issue' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'ADF' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Print' })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Issue' })).not.toBeInTheDocument();
    // BR-63: ADF has no rendered output at all — no Preview either, not just no Print.
    expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeInTheDocument();
  });

  function createFakeWindow() {
    return {
      document: { write: vi.fn(), open: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
    };
  }

  it('Print opens the window synchronously (before the fetch resolves) and writes the fetched HTML into it', async () => {
    const fakeWindow = createFakeWindow();
    const openSpy = vi.fn().mockReturnValue(fakeWindow);
    vi.stubGlobal('open', openSpy);
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/readiness'))
          return Promise.resolve(jsonResponse(200, { ready: true, missingFields: [] }));
        if (url.includes('/print'))
          return Promise.resolve(
            jsonResponse(200, { html: '<p>THE DOCUMENT</p>', pageSize: 'A4' }),
          );
        return Promise.resolve(jsonResponse(200, stickerFixture));
      }),
    );

    renderSection();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Print' }));

    // window.open is called synchronously, inside the click handler, before
    // the print-payload fetch has resolved — that's what keeps it from
    // being treated as a popup outside a user gesture.
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(fakeWindow.document.write).toHaveBeenCalledWith(expect.stringContaining('Preparing'));

    await waitFor(() => expect(fakeWindow.print).toHaveBeenCalledTimes(1));
    expect(fakeWindow.document.write).toHaveBeenCalledWith('<p>THE DOCUMENT</p>');
    expect(fakeWindow.focus).toHaveBeenCalled();
  });

  it('shows a clear message instead of silently failing when the print window is popup-blocked', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/readiness'))
        return Promise.resolve(jsonResponse(200, { ready: true, missingFields: [] }));
      return Promise.resolve(jsonResponse(200, stickerFixture));
    });
    vi.stubGlobal('open', vi.fn().mockReturnValue(null));
    vi.stubGlobal('fetch', fetchMock);

    renderSection();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument());
    const printCallsBefore = fetchMock.mock.calls.filter((c) => c[0].includes('/print')).length;

    fireEvent.click(screen.getByRole('button', { name: 'Print' }));

    expect(useToastStore.getState().message).toMatch(/pop-up blocked/i);
    // Never even attempted the print-payload fetch — nothing to prepare
    // for a window that doesn't exist.
    const printCallsAfter = fetchMock.mock.calls.filter((c) => c[0].includes('/print')).length;
    expect(printCallsAfter).toBe(printCallsBefore);
  });

  it('shows an error toast instead of failing silently when the print payload request fails', async () => {
    const fakeWindow = createFakeWindow();
    vi.stubGlobal('open', vi.fn().mockReturnValue(fakeWindow));
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/readiness'))
          return Promise.resolve(jsonResponse(200, { ready: true, missingFields: [] }));
        if (url.includes('/print')) {
          return Promise.resolve(
            jsonResponse(500, { error: { code: 'INTERNAL', message: 'render failed' } }),
          );
        }
        return Promise.resolve(jsonResponse(200, stickerFixture));
      }),
    );

    renderSection();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Print' }));

    await waitFor(() => expect(fakeWindow.close).toHaveBeenCalledTimes(1));
    expect(useToastStore.getState().message).toBeTruthy();
  });

  it('Preview toggles an inline rendered view without opening a new window', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/readiness'))
          return Promise.resolve(jsonResponse(200, { ready: true, missingFields: [] }));
        if (url.includes('/print'))
          return Promise.resolve(
            jsonResponse(200, { html: '<p>PREVIEW BODY</p>', pageSize: 'A4' }),
          );
        return Promise.resolve(jsonResponse(200, stickerFixture));
      }),
    );

    renderSection();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    const frame = await screen.findByTitle('Security Clearance preview');
    expect(frame).toHaveAttribute('srcdoc', '<p>PREVIEW BODY</p>');

    fireEvent.click(screen.getByRole('button', { name: 'Hide Preview' }));
    expect(screen.queryByTitle('Security Clearance preview')).not.toBeInTheDocument();
  });

  it('labels the AWB Sticker print action distinctly, as "Print Sticker"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/readiness'))
          return Promise.resolve(jsonResponse(200, { ready: true, missingFields: [] }));
        return Promise.resolve(
          jsonResponse(200, { ...stickerFixture, id: 'doc-3', type: 'AWB_STICKER' }),
        );
      }),
    );

    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'AWB Sticker' }));

    expect(await screen.findByRole('button', { name: 'Print Sticker' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
  });

  it('shows an error toast instead of failing silently when Download fails', async () => {
    const issuedPdfFixture = {
      ...stickerFixture,
      status: 'ISSUED',
      hasStoredFile: true,
      issuedAt: '2026-08-02T00:00:00.000Z',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/readiness'))
          return Promise.resolve(jsonResponse(200, { ready: true, missingFields: [] }));
        // downloadDocumentFile hits this URL directly (not via apiFetch) —
        // fail it explicitly rather than relying on the fixture branch.
        if (url.includes('/documents/') && url.endsWith('/file')) {
          return Promise.resolve({ ok: false, status: 500 });
        }
        return Promise.resolve(jsonResponse(200, issuedPdfFixture));
      }),
    );

    renderSection();
    const downloadButton = await screen.findByRole('button', { name: 'Download' });

    fireEvent.click(downloadButton);

    await waitFor(() => expect(useToastStore.getState().message).toBeTruthy());
  });
});
