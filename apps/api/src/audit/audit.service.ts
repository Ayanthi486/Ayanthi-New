import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export interface AuditActor {
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuditRecordInput {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  before?: unknown;
  after?: unknown;
}

/** Anything with Prisma's `auditLog` delegate — the base PrismaService or a `tx`. */
type AuditLogWriter = Pick<PrismaService, 'auditLog'>;

/**
 * Automatic audit capture (ARCHITECTURE §10 layer 1) is a PostgreSQL
 * trigger (`apps/api/prisma/migrations/*_audit_capture_triggers`), not a
 * Prisma Client extension — a Client extension was tried first and
 * empirically failed: Node's AsyncLocalStorage context reliably survives a
 * Prisma `create` call but not `update`/`delete`, which would have
 * silently broken audit capture for most real mutations (see that
 * migration's comment for the full account). The trigger fires as part of
 * the same statement/transaction by Postgres's own construction —
 * unconditionally, so it cannot be bypassed by a forgotten wrapper either.
 *
 * `auditedTransaction` only needs to hand the trigger *who* is acting, via
 * `SET LOCAL` session variables the trigger reads with `current_setting`.
 * `LOCAL` means they never outlive the transaction, so nothing leaks to a
 * connection pool's next borrower.
 */
@Injectable()
export class AuditService {
  async auditedTransaction<T>(
    prisma: PrismaService,
    actor: AuditActor,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.actor_user_id', ${actor.userId ?? ''}, true)`;
      await tx.$executeRaw`SELECT set_config('app.actor_ip', ${actor.ipAddress ?? ''}, true)`;
      await tx.$executeRaw`SELECT set_config('app.actor_user_agent', ${actor.userAgent ?? ''}, true)`;

      return fn(tx);
    });
  }

  /**
   * Explicit semantic audit write (ARCHITECTURE §10 layer 2) for events
   * with no corresponding row mutation to auto-capture — login success or
   * failure, logout, refresh-token reuse detection.
   */
  async record(prisma: AuditLogWriter, entry: AuditRecordInput): Promise<void> {
    await prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        before: toInputJson(entry.before),
        after: toInputJson(entry.after),
      },
    });
  }
}

function toInputJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === null || value === undefined) {
    return Prisma.DbNull;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
