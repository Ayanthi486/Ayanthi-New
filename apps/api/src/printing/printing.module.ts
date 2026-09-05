import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.validation';
import { PdfPrinterAdapter } from './pdf-printer.adapter';
import { PrinterAdapter } from './printer-adapter';
import { ZebraZd420Adapter } from './zebra-zd420.adapter';

/** ARCHITECTURE §13: adapter selection lives in configuration, not code. */
@Module({
  imports: [ConfigModule],
  providers: [
    PdfPrinterAdapter,
    ZebraZd420Adapter,
    {
      provide: PrinterAdapter,
      inject: [ConfigService, PdfPrinterAdapter, ZebraZd420Adapter],
      useFactory: (
        config: ConfigService<EnvConfig, true>,
        pdfAdapter: PdfPrinterAdapter,
        zebraAdapter: ZebraZd420Adapter,
      ) =>
        config.get('PRINTER_ADAPTER', { infer: true }) === 'zebra_zd420'
          ? zebraAdapter
          : pdfAdapter,
    },
  ],
  exports: [PrinterAdapter],
})
export class PrintingModule {}
