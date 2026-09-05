import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { EnvConfig } from '../config/env.validation';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Thin wrapper around PrismaClient managing connection lifecycle with the
 * Nest module lifecycle. Business modules inject this rather than
 * instantiating their own client (ARCHITECTURE §6).
 *
 * Prisma 7 has no built-in query engine — a driver adapter is mandatory
 * (see prisma.config.ts for the CLI-side connection configuration).
 *
 * Connects via APP_DATABASE_URL — a restricted database role with no
 * UPDATE/DELETE on audit_log at the grant level (ARCHITECTURE §10). The
 * privileged DATABASE_URL is used only by prisma.config.ts / the CLI for
 * migrations, never by the running application.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<EnvConfig, true>) {
    super({
      adapter: new PrismaPg({ connectionString: config.get('APP_DATABASE_URL', { infer: true }) }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
