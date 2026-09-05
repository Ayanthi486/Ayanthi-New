import { Module } from '@nestjs/common';
import { CutoffController } from './cutoff.controller';
import { CutoffService } from './cutoff.service';

/**
 * Imported by both `AppModule` (the acknowledge/list HTTP routes) and
 * `WorkerModule` (the cron body) — `CutoffService` is the same code either
 * way (ARCHITECTURE §2). `CutoffController` is harmless to register in the
 * worker's application context too (`createApplicationContext` never starts
 * an HTTP listener, so no routes are actually served there).
 */
@Module({
  controllers: [CutoffController],
  providers: [CutoffService],
  exports: [CutoffService],
})
export class CutoffModule {}
