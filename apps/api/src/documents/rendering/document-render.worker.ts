import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import type { EnvConfig } from '../../config/env.validation';
import { StorageService } from '../../storage/storage.service';
import { DocumentRenderer } from './document-renderer';
import {
  DOCUMENT_RENDER_QUEUE,
  type DocumentRenderJobData,
  type DocumentRenderJobResult,
} from './queue.constants';

/**
 * ARCHITECTURE §11/§15: the actual Puppeteer render + StorageService save,
 * running only here — never in the API's HTTP process. Concurrency is
 * capped inside `PuppeteerDocumentRenderer` itself (decision: the cap
 * applies per Chromium instance, not per BullMQ worker concurrency knob,
 * so this Worker's own `concurrency` stays at the same value for a single
 * enforcement point).
 */
@Injectable()
export class DocumentRenderWorker {
  private readonly logger = new Logger(DocumentRenderWorker.name);
  private worker: Worker<DocumentRenderJobData, DocumentRenderJobResult> | null = null;

  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly renderer: DocumentRenderer,
    private readonly storage: StorageService,
  ) {}

  start(): void {
    const connection = new IORedis(this.config.get('REDIS_URL', { infer: true }), {
      maxRetriesPerRequest: null,
    });
    const concurrency = this.config.get('PDF_RENDER_CONCURRENCY', { infer: true });

    this.worker = new Worker<DocumentRenderJobData, DocumentRenderJobResult>(
      DOCUMENT_RENDER_QUEUE,
      (job: Job<DocumentRenderJobData>) => this.process(job),
      { connection, concurrency },
    );

    this.worker.on('completed', (job) => this.logger.log(`Rendered document job ${job.id}`));
    this.worker.on('failed', (job, err) =>
      this.logger.error(`Render job ${job?.id} failed: ${err.message}`),
    );
  }

  async close(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<DocumentRenderJobData>): Promise<DocumentRenderJobResult> {
    const pdf = await this.renderer.renderPdf(job.data.html);
    const saved = await this.storage.save({ buffer: pdf, prefix: 'documents', extension: 'pdf' });
    return { storageKey: saved.key, sha256: saved.sha256, size: saved.size };
  }
}
