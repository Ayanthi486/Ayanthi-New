import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { AuditModule } from './audit/audit.module';
import { validateEnv, type EnvConfig } from './config/env.validation';
import { CutoffCronService } from './cutoff/cutoff-cron.service';
import { CutoffModule } from './cutoff/cutoff.module';
import { DocumentRenderWorker } from './documents/rendering/document-render.worker';
import { RenderingModule } from './documents/rendering/rendering.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';

/**
 * ARCHITECTURE §1: "Two deployables, not one, not twelve." Bootstrapped by
 * `worker-main.ts` as a Nest application context (no HTTP server), a second
 * entry point in this same package rather than a parallel workspace package
 * (Phase 7 report, decision #1). Phase 8 is the first to need database
 * access here — `PrismaModule`/`AuditModule` alongside the existing
 * `StorageModule`/`RenderingModule` (PDF rendering) and now `CutoffModule` +
 * `ScheduleModule` (cut-off evaluation, every 5 min — ARCHITECTURE §15).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env', '../../.env'],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          transport: config.get('LOG_PRETTY', { infer: true })
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        },
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    StorageModule,
    RenderingModule,
    CutoffModule,
  ],
  providers: [DocumentRenderWorker, CutoffCronService],
})
export class WorkerModule {}
