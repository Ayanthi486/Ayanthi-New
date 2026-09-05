import { Injectable, Logger } from '@nestjs/common';
import { PrinterAdapter, type PrintJob } from './printer-adapter';

/**
 * ARCHITECTURE §13: "browser print path — works from day one." A Node
 * backend has no way to trigger a client's print dialog itself — that is
 * inherently client-side (`window.print()` on the rendered HTML this
 * document's `GET .../print` endpoint returns). This adapter's `print()` is
 * therefore a confirming no-op: it exists so callers go through the same
 * `PrinterAdapter` interface regardless of which adapter is configured,
 * satisfying BR-36's replaceability requirement without pretending the API
 * does something it structurally cannot.
 */
@Injectable()
export class PdfPrinterAdapter extends PrinterAdapter {
  private readonly logger = new Logger(PdfPrinterAdapter.name);

  print(job: PrintJob): Promise<void> {
    this.logger.debug(`Print requested via browser path (${job.pageSize})`);
    return Promise.resolve();
  }
}
