import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import type { EnvConfig } from '../../config/env.validation';
import {
  DOCUMENT_RENDER_JOB,
  DOCUMENT_RENDER_QUEUE,
  type DocumentRenderJobData,
  type DocumentRenderJobResult,
} from './queue.constants';

/**
 * ARCHITECTURE §14: "Issue document | version freeze + snapshot + stored
 * file reference + audit" is one atomic transaction — the API must have the
 * rendered file's storage key *before* committing that transaction. So the
 * API enqueues the render job and awaits its result (BullMQ's QueueEvents
 * pattern) rather than firing-and-forgetting; the actual Puppeteer work
 * still only ever runs in the worker process (ARCHITECTURE §11).
 */
@Injectable()
export class DocumentRenderQueueService implements OnModuleDestroy {
  private readonly connection: IORedis;
  private readonly queue: Queue<DocumentRenderJobData, DocumentRenderJobResult>;
  private readonly queueEvents: QueueEvents;

  constructor(config: ConfigService<EnvConfig, true>) {
    this.connection = new IORedis(config.get('REDIS_URL', { infer: true }), {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue(DOCUMENT_RENDER_QUEUE, { connection: this.connection });
    this.queueEvents = new QueueEvents(DOCUMENT_RENDER_QUEUE, { connection: this.connection });
  }

  async renderAndAwait(html: string, timeoutMs: number): Promise<DocumentRenderJobResult> {
    const job = await this.queue.add(DOCUMENT_RENDER_JOB, { html });
    return job.waitUntilFinished(this.queueEvents, timeoutMs);
  }

  async onModuleDestroy(): Promise<void> {
    await this.queueEvents.close();
    await this.queue.close();
    this.connection.disconnect();
  }
}
