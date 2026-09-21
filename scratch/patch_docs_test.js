const fs = require('fs');

let c = fs.readFileSync('apps/web/src/features/documents/components/DocumentsSection.test.tsx', 'utf-8');

c = c.replace(/close: vi.fn\(\),\n    };\n  }/g, 'close: vi.fn(),\n      location: {} as any,\n    };\n  }');

c = c.replace(/'AWB',\n          'Box Picture',\n          'Other Documents',\n          'CUSDEC',/g, "'AWB',\n          'Shipment Documents',\n          'CUSDEC',");
c = c.replace(/'AWB',\n      'Box Picture',\n      'Other Documents',\n      'CUSDEC',/g, "'AWB',\n      'Shipment Documents',\n      'CUSDEC',");
c = c.replace(/expect\(screen.getByRole\('button', { name: 'Other Documents' }\)\).toBeInTheDocument\(\);/g, "expect(screen.getByRole('button', { name: 'Shipment Documents' })).toBeInTheDocument();");

const oldAdfTabTest = `    it('switches to the ADF tab: an upload-only document, not the generate/edit/issue flow', async () => {
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
      fireEvent.click(screen.getByRole('button', { name: 'ADF' }));

      await waitFor(() => {
        expect(screen.getByText('No file has been uploaded yet.')).toBeInTheDocument();
      });
      expect(screen.getByLabelText('Upload file (PDF)')).toBeInTheDocument();
    });`;

const newAdfTabTest = `    it('switches to the ADF tab: an upload-only document, not the generate/edit/issue flow', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (url.includes('/readiness'))
            return Promise.resolve(jsonResponse(200, { ready: true, missingFields: [] }));
          if (url.includes('/attachments')) {
            return Promise.resolve(jsonResponse(200, []));
          }
          return Promise.resolve(jsonResponse(200, stickerFixture));
        }),
      );

      renderSection();
      fireEvent.click(screen.getByRole('button', { name: 'ADF' }));

      await waitFor(() => {
        expect(screen.getByText('No files attached yet.')).toBeInTheDocument();
      });
      expect(screen.getByLabelText('Upload a file')).toBeInTheDocument();
    });`;

c = c.replace(oldAdfTabTest, newAdfTabTest);

const oldAdfUploadTest = `    it('ADF shows Print/Download once a file has been uploaded, and uploading calls the upload endpoint', async () => {
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
    });`;

const newAdfUploadTest = `    it('ADF shows Download/Remove once a file has been uploaded, and uploading calls the upload endpoint', async () => {
      const uploadedAttachment = {
        id: 'attach-1',
        filename: 'doc.pdf',
        size: 1024,
        createdAt: '2026-08-02T00:00:00.000Z',
        category: 'ADF',
      };
      const fetchMock = vi.fn((url: string, init?: RequestInit) => {
        if (url.includes('/readiness'))
          return Promise.resolve(jsonResponse(200, { ready: true, missingFields: [] }));
        if (url.includes('/attachments') && init?.method === 'POST') {
          return Promise.resolve(jsonResponse(201, uploadedAttachment));
        }
        if (url.includes('/attachments')) {
          return Promise.resolve(jsonResponse(200, [uploadedAttachment]));
        }
        return Promise.resolve(jsonResponse(200, stickerFixture));
      });
      vi.stubGlobal('fetch', fetchMock);

      renderSection();
      fireEvent.click(await screen.findByRole('button', { name: 'ADF' }));

      const fileInput = await screen.findByLabelText('Upload a file');
      expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();

      const file = new File(['%PDF-1.4'], 'doc.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() =>
        expect(
          fetchMock.mock.calls.some(
            (c) => c[0].includes('/attachments') && c[1]?.method === 'POST',
          ),
        ).toBe(true),
      );
    });`;

c = c.replace(oldAdfUploadTest, newAdfUploadTest);

fs.writeFileSync('apps/web/src/features/documents/components/DocumentsSection.test.tsx', c);
