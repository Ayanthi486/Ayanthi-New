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
    // Security Clearance/AWB Sticker/CDN are Executive-only, gated on
    // documents.basic.manage — this suite mostly exercises those three
    // tabs, so the default test user holds both that and the broader
    // documents.manage (needed for ADF/AWB/Other Documents).
    useAuthStore.setState({
      permissions: new Set(['documents.manage', 'documents.basic.manage']),
    });
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
    fireEvent.click(screen.getByText('AWB Sticker'));

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

  it('switches to the ADF tab: an upload-only document, not the generate/edit/issue flow', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/readiness'))
          return Promise.resolve(jsonResponse(200, { ready: true, missingFields: [] }));
        if (url.includes('/documents/ADF')) {
          return Promise.resolve(
            jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'not found' } }),
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
      expect(screen.getByText('No file has been uploaded yet.')).toBeInTheDocument();
    });
    // The generate/edit/issue flow (Preview/Print/Issue/Create) never applies to an upload type.
    expect(screen.queryByRole('button', { name: 'Print' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Issue' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create ADF' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Upload file (PDF)')).toBeInTheDocument();
  });

  it('ADF shows Print/Download once a file has been uploaded, and uploading calls the upload endpoint', async () => {
    const uploadedAdfFixture = {
      ...stickerFixture,
      id: 'doc-adf-1',
      type: 'ADF',
      status: 'ISSUED',
      hasStoredFile: true,
      issuedAt: '2026-08-02T00:00:00.000Z',
    };
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/readiness'))
        return Promise.resolve(jsonResponse(200, { ready: true, missingFields: [] }));
      if (url.includes('/documents/ADF/upload') && init?.method === 'POST') {
        return Promise.resolve(jsonResponse(201, uploadedAdfFixture));
      }
      if (url.includes('/documents/ADF')) {
        return Promise.resolve(jsonResponse(200, uploadedAdfFixture));
      }
      return Promise.resolve(jsonResponse(200, stickerFixture));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'ADF' }));

    const fileInput = await screen.findByLabelText('Replace file (PDF)');
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();

    const file = new File(['%PDF-1.4'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          (c) => c[0].includes('/documents/ADF/upload') && c[1]?.method === 'POST',
        ),
      ).toBe(true),
    );
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

  it('Create shows a Confirm/Cancel step first — Cancel backs out with no request', async () => {
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
      if (url.includes('/readiness'))
        return Promise.resolve(jsonResponse(200, { ready: true, missingFields: [] }));
      return Promise.resolve(
        jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'not found' } }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    renderSection();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Create Security Clearance' }),
    );

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    const postCallsBefore = fetchMock.mock.calls.filter(
      (c) => c[1]?.method === 'POST',
    ).length;

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Create Security Clearance' })).toBeInTheDocument();
    const postCallsAfter = fetchMock.mock.calls.filter((c) => c[1]?.method === 'POST').length;
    expect(postCallsAfter).toBe(postCallsBefore);
  });

  it('field data starts read-only with an Edit button; Cancel reverts without saving', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/readiness'))
          return Promise.resolve(jsonResponse(200, { ready: true, missingFields: [] }));
        return Promise.resolve(jsonResponse(200, stickerFixture));
      }),
    );

    renderSection();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());

    const input = screen.getByLabelText('Handover — Name of Employee') as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(input).not.toBeDisabled();
    fireEvent.change(input, { target: { value: 'Someone' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
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

  it('with full permissions, shows all 9 tabs in the requested order', async () => {
    useAuthStore.setState({
      permissions: new Set([
        'documents.manage',
        'documents.basic.manage',
        'costsheet.view',
        'invoice.view',
        'invoice.view.readonly',
      ]),
    });
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
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Security Clearance' })).toBeInTheDocument(),
    );

    const tabs = screen
      .getAllByRole('button')
      .map((button) => button.textContent)
      .filter((label): label is string =>
        [
          'Security Clearance',
          'AWB Sticker',
          'CDN',
          'Cost Sheet',
          'ADF',
           'AWB',
          'Box Picture',
          'Other Documents',
          'CUSDEC',
          'Freight Invoice',
        ].includes(label ?? ''),
      );

    expect(tabs).toEqual([
      'Security Clearance',
      'AWB Sticker',
      'CDN',
      'Cost Sheet',
      'ADF',
       'AWB',
          'Box Picture',
      'Other Documents',
      'CUSDEC',
      'Freight Invoice',
    ]);
  });

  it('without costsheet/invoice permissions, those two tabs are hidden', async () => {
    // beforeEach already grants only documents.manage.
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
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Security Clearance' })).toBeInTheDocument(),
    );

    expect(screen.queryByRole('button', { name: 'Cost Sheet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Freight Invoice' })).not.toBeInTheDocument();
  });

  it('without documents.basic.manage (e.g. Manager), Security Clearance/AWB Sticker/CDN are hidden but ADF/AWB/Other Documents remain', async () => {
    useAuthStore.setState({ permissions: new Set(['documents.manage']) });
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
    await waitFor(() => expect(screen.getByRole('button', { name: 'ADF' })).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'Security Clearance' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'AWB Sticker' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'CDN' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AWB' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Other Documents' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CUSDEC' })).toBeInTheDocument();
  });

  it('clicking the Cost Sheet tab switches the pane to Cost Sheet content', async () => {
    useAuthStore.setState({ permissions: new Set(['documents.manage', 'costsheet.view']) });
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
    fireEvent.click(await screen.findByRole('button', { name: 'Cost Sheet' }));

    expect(
      await screen.findByText("Hub Lanka's internal operational expenses, in LKR."),
    ).toBeInTheDocument();
  });
});
