import { z } from 'zod';

/**
 * Boot-time environment schema (ARCHITECTURE §24: "environment variables
 * validated with Zod at boot (fail fast)"). Nest's ConfigModule runs this
 * once via `validate` and refuses to start the process on a bad value.
 *
 * Auth-related keys are validated here even though no Auth module consumes
 * them until Phase 1 (DEVELOPMENT_PLAN Phase 0 item 5: auth foundation only).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  API_PORT: z.coerce.number().int().positive().default(3000),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  CORS_ORIGINS: z.string().min(1).default('http://localhost:5173'),
  SWAGGER_ENABLED: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),

  // Migration/CLI connection (privileged role — prisma.config.ts, Docker
  // entrypoint's `db:migrate:deploy`). Never used by the running app.
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Runtime connection (restricted role — no UPDATE/DELETE on audit_log at
  // the database grant level). PrismaService uses this one exclusively.
  APP_DATABASE_URL: z.string().min(1, 'APP_DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('7d'),
  REFRESH_TOKEN_COOKIE_NAME: z.string().min(1).default('hub_lanka_refresh_token'),

  ARGON2_MEMORY_COST: z.coerce.number().int().positive().default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().positive().default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().positive().default(1),

  LOGIN_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_DURATION_MINUTES: z.coerce.number().int().positive().default(15),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),

  // ARCHITECTURE §12: local-disk StorageService adapter for development —
  // an R2 adapter behind the same interface arrives when there is a real
  // bucket/credentials to build and test against.
  STORAGE_LOCAL_DIR: z.string().min(1).default('./storage-local'),
  // Not company-stated (receipt uploads, BR-56) — an inferred, configurable default.
  RECEIPT_MAX_SIZE_MB: z.coerce.number().int().positive().default(10),
  // Not company-stated — an inferred, configurable default for user profile
  // photo uploads (deliberately smaller than a receipt).
  AVATAR_MAX_SIZE_MB: z.coerce.number().int().positive().default(3),

  // ARCHITECTURE §15: BullMQ/Redis for the dedicated worker process (PDF
  // rendering this phase; cut-off/outbox jobs arrive with their own phases).
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  // ARCHITECTURE §13: adapter selection lives in configuration, not code.
  PRINTER_ADAPTER: z.enum(['pdf', 'zebra_zd420']).default('pdf'),
  // ARCHITECTURE §11: 1-2 Chromium contexts, capped.
  PDF_RENDER_CONCURRENCY: z.coerce.number().int().positive().max(4).default(2),
  PDF_RENDER_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  // BR-21: confirmed 5 hours, still configurable per DEVELOPMENT_PLAN.md's
  // "configurable thresholds" instruction. CUTOFF_URGENT_HOURS has NO
  // confirmed value anywhere in PRD/CONTEXT — an inferred default,
  // flagged in the Phase 8 report, not a company-stated rule.
  CUTOFF_APPROACHING_HOURS: z.coerce.number().positive().default(5),
  CUTOFF_URGENT_HOURS: z.coerce.number().positive().default(1),

  // OQ-5: fallback only, used to convert a shipment's USD airline buying
  // cost into LKR for profit reporting when that shipment's own invoice has
  // no exchangeRate set yet — 340.50 is PRD §8's reference-invoice example
  // rate, not a live market rate. Whenever an invoice.exchangeRate exists,
  // that per-shipment historical rate is used instead (analytics.service.ts).
  ANALYTICS_FALLBACK_EXCHANGE_RATE: z.coerce.number().positive().default(340.5),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }

  return result.data;
}
