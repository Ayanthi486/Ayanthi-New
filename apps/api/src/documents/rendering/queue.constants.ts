/** ARCHITECTURE §15: "PDF rendering | on demand | Concurrency capped." Shared between the API producer and the worker consumer. */
export const DOCUMENT_RENDER_QUEUE = 'document-render';
export const DOCUMENT_RENDER_JOB = 'render';

export interface DocumentRenderJobData {
  html: string;
}

export interface DocumentRenderJobResult {
  storageKey: string;
  sha256: string;
  size: number;
}
