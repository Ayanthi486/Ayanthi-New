/**
 * ARCHITECTURE §13: printer integration sits behind a replaceable adapter so
 * a future printer change never touches document or business logic
 * (BR-36). Business/document code depends only on this interface.
 */
export interface PrintJob {
  /** Already-rendered HTML — the adapter decides how to turn it into ink, never what it says. */
  html: string;
  /** CSS `@page` size, e.g. "12cm 8cm" or "A4". Informational for adapters that just hand off to the browser. */
  pageSize: string;
}

export abstract class PrinterAdapter {
  abstract print(job: PrintJob): Promise<void>;
}
