import { Module } from '@nestjs/common';
import { DocumentRenderer } from './document-renderer';
import { PuppeteerDocumentRenderer } from './puppeteer-document-renderer';

/** Worker-only — the API's HTTP process never imports this (ARCHITECTURE §11: "rendering happens only in the worker"). */
@Module({
  providers: [{ provide: DocumentRenderer, useClass: PuppeteerDocumentRenderer }],
  exports: [DocumentRenderer],
})
export class RenderingModule {}
