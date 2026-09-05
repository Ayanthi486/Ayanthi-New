import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { DocumentRenderWorker } from './documents/rendering/document-render.worker';
import { WorkerModule } from './worker.module';

/**
 * ARCHITECTURE §1: the second of "two deployables, not one, not twelve" —
 * an application context (no HTTP server, no guards/controllers), started
 * as its own process/container (`docker-compose.yml`'s `worker` service).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });

  const logger = app.get(Logger);
  app.useLogger(logger);

  const renderWorker = app.get(DocumentRenderWorker);
  renderWorker.start();
  logger.log('Hub Lanka document-render worker started');

  const shutdown = async (): Promise<void> => {
    await renderWorker.close();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

void bootstrap();
