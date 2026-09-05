/**
 * ARCHITECTURE §11: "Rendering happens only in the worker, with concurrency
 * capped (1-2 Chromium contexts) and a render timeout." Isolated behind an
 * interface so the API side (which enqueues a render job) and unit tests
 * never depend on a real Chromium subprocess directly.
 */
export abstract class DocumentRenderer {
  abstract renderPdf(html: string): Promise<Buffer>;
}
