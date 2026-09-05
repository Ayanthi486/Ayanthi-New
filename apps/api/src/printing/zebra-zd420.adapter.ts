import { Injectable, Logger } from '@nestjs/common';
import { PrinterAdapter, type PrintJob } from './printer-adapter';

/**
 * ARCHITECTURE §13: "the exact protocol is implementation-level and may be
 * resolved during Phase 7; nothing above the adapter boundary changes when
 * it is." There is no real ZD420 hardware to build or test a cable/ZPL
 * protocol against in this environment, so this stub deliberately behaves
 * exactly like `PdfPrinterAdapter` (browser print path, same 12x8cm HTML) —
 * an honest placeholder behind the real interface, not a fabricated
 * protocol. Swapping in the real cable/ZPL implementation later is a
 * one-line provider change (`printing.module.ts`), never a call-site change.
 */
@Injectable()
export class ZebraZd420Adapter extends PrinterAdapter {
  private readonly logger = new Logger(ZebraZd420Adapter.name);

  print(job: PrintJob): Promise<void> {
    this.logger.warn(
      `ZebraZd420Adapter is a stub (no ZPL/cable protocol implemented yet) — falling back to the browser print path for ${job.pageSize}`,
    );
    return Promise.resolve();
  }
}
