import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer, { type Browser } from 'puppeteer';
import type { EnvConfig } from '../../config/env.validation';
import { DocumentRenderer } from './document-renderer';

/**
 * ARCHITECTURE §11: worker-only, concurrency capped at 1-2 Chromium
 * contexts, render timeout enforced. One `Browser` process is launched
 * lazily and reused (launching Chromium per render would defeat the
 * concurrency cap's purpose); a small counting semaphore enforces the cap
 * across concurrent `renderPdf` calls, each on its own `Page`.
 */
@Injectable()
export class PuppeteerDocumentRenderer extends DocumentRenderer implements OnModuleDestroy {
  private readonly logger = new Logger(PuppeteerDocumentRenderer.name);
  private browserPromise: Promise<Browser> | null = null;
  private inFlight = 0;
  private readonly waiters: (() => void)[] = [];

  constructor(private readonly config: ConfigService<EnvConfig, true>) {
    super();
  }

  async renderPdf(html: string): Promise<Buffer> {
    await this.acquireSlot();
    try {
      return await this.renderWithTimeout(html);
    } finally {
      this.releaseSlot();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browserPromise) {
      const browser = await this.browserPromise;
      await browser.close();
    }
  }

  private async renderWithTimeout(html: string): Promise<Buffer> {
    const timeoutMs = this.config.get('PDF_RENDER_TIMEOUT_MS', { infer: true });
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`PDF render exceeded ${timeoutMs}ms`)), timeoutMs);
      });
      return await Promise.race([this.renderPage(page, html), timeout]);
    } finally {
      await page.close();
    }
  }

  private async renderPage(page: import('puppeteer').Page, html: string): Promise<Buffer> {
    // No external network requests — the HTML is fully self-contained
    // (inline CSS, no external images/fonts) — 'load' is sufficient.
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.logger.log('Launching headless Chromium for document rendering');
      this.browserPromise = puppeteer.launch({
        headless: true,
        // Picks up PUPPETEER_EXECUTABLE_PATH automatically when set (the
        // Dockerfile's Debian chromium package, Phase 7 decision #9) — no
        // executablePath override needed here for local dev's own download.
        // --no-sandbox is required for Chromium in most container runtimes;
        // acceptable here because every render input is our own trusted
        // template HTML, never third-party or user-supplied content.
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browserPromise;
  }

  private async acquireSlot(): Promise<void> {
    const limit = this.config.get('PDF_RENDER_CONCURRENCY', { infer: true });
    if (this.inFlight < limit) {
      this.inFlight++;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.inFlight++;
  }

  private releaseSlot(): void {
    this.inFlight--;
    const next = this.waiters.shift();
    if (next) next();
  }
}
