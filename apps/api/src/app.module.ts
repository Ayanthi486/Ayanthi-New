import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { AnalyticsModule } from './analytics/analytics.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuditModule } from './audit/audit.module';
import { CargoModule } from './cargo/cargo.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { validateEnv, type EnvConfig } from './config/env.validation';
import { CostSheetModule } from './costsheet/costsheet.module';
import { CutoffModule } from './cutoff/cutoff.module';
import { DocumentsModule } from './documents/documents.module';
import { HealthModule } from './health/health.module';
import { JwtAuthGuard } from './identity/guards/jwt-auth.guard';
import { PermissionsGuard } from './identity/guards/permissions.guard';
import { IdentityModule } from './identity/identity.module';
import { InvoiceModule } from './invoice/invoice.module';
import { MasterdataModule } from './masterdata/masterdata.module';
import { PaymentModule } from './payment/payment.module';
import { PrintingModule } from './printing/printing.module';
import { PrismaModule } from './prisma/prisma.module';
import { RatesModule } from './rates/rates.module';
import { ShipmentModule } from './shipment/shipment.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // Supports running from the repo root (`pnpm dev` via Turborepo,
      // cwd = apps/api) and from apps/api directly — whichever `.env`
      // exists is loaded; Docker Compose sets real env vars and needs
      // neither.
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
          genReqId: (req: { headers: Record<string, unknown> }) =>
            req.headers['x-request-id'] ?? crypto.randomUUID(),
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        },
      }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
      // The e2e suite exercises many auth attempts (lockout, reuse
      // detection, ...) from one client IP within seconds — throttling
      // stays fully active in development/production, only NODE_ENV=test
      // skips it. Not a general escape hatch: env.validation.ts restricts
      // NODE_ENV to development/test/production, so this cannot be set in
      // a real deployment.
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    // Also imported by IdentityModule for AuthService's own JwtService use;
    // imported here too so JwtAuthGuard (registered as a global APP_GUARD
    // below, in this module's own injector context) can inject JwtService.
    JwtModule.register({}),
    PrismaModule,
    AuditModule,
    IdentityModule,
    MasterdataModule,
    RatesModule,
    ShipmentModule,
    CargoModule,
    CostSheetModule,
    InvoiceModule,
    StorageModule,
    PaymentModule,
    PrintingModule,
    DocumentsModule,
    AttachmentsModule,
    CutoffModule,
    AnalyticsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Order matters: rate-limit → authenticate → authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
