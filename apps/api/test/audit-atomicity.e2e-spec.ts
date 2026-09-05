import { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';

/**
 * Proves DEVELOPMENT_PLAN Phase 1's explicit test requirement: "audit
 * written inside the transaction." Automatic capture is a PostgreSQL
 * trigger (see apps/api/prisma/migrations/*_audit_capture_triggers for why
 * — a Prisma Client extension was tried first and empirically failed to
 * propagate actor context through `update`/`delete` reliably), so this
 * atomicity is really Postgres's own transactional guarantee — this test
 * exists to prove it holds through the exact path the app uses
 * (AuditService#auditedTransaction), not to re-prove Postgres works.
 */
describe('Audit atomicity (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auditService: AuditService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    auditService = app.get(AuditService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rolls back both the mutation and its audit row on a forced failure', async () => {
    const roleName = `AtomicityRollback-${Date.now()}`;

    await expect(
      auditService.auditedTransaction(
        prisma,
        { userId: null, ipAddress: null, userAgent: null },
        async (tx) => {
          await tx.role.create({ data: { name: roleName } });
          throw new Error('forced failure after mutation');
        },
      ),
    ).rejects.toThrow('forced failure after mutation');

    const role = await prisma.role.findFirst({ where: { name: roleName } });
    const auditRow = await prisma.auditLog.findFirst({
      where: {
        entityType: 'role',
        action: 'role.create',
        after: { path: ['name'], equals: roleName },
      },
    });

    expect(role).toBeNull();
    expect(auditRow).toBeNull();
  });

  it('commits both the mutation and its correlated audit row on success, with an accurate before/after diff', async () => {
    const roleName = `AtomicityCommit-${Date.now()}`;

    const created = await auditService.auditedTransaction(
      prisma,
      { userId: null, ipAddress: null, userAgent: null },
      (tx) => tx.role.create({ data: { name: roleName } }),
    );

    await auditService.auditedTransaction(
      prisma,
      { userId: null, ipAddress: null, userAgent: null },
      (tx) => tx.role.update({ where: { id: created.id }, data: { description: 'updated' } }),
    );

    const createRow = await prisma.auditLog.findFirst({
      where: { entityType: 'role', action: 'role.create', entityId: created.id },
    });
    const updateRow = await prisma.auditLog.findFirst({
      where: { entityType: 'role', action: 'role.update', entityId: created.id },
    });

    expect(createRow).not.toBeNull();
    expect((createRow?.after as { name: string } | null)?.name).toBe(roleName);

    expect(updateRow).not.toBeNull();
    expect((updateRow?.before as { description: string | null } | null)?.description).toBeNull();
    expect((updateRow?.after as { description: string | null } | null)?.description).toBe(
      'updated',
    );

    await prisma.role.delete({ where: { id: created.id } });
  });

  it('attributes the audit row to the actor passed into auditedTransaction', async () => {
    const seedManager = await prisma.user.findUniqueOrThrow({
      where: { email: 'manager@hublanka.dev' },
    });
    const roleName = `AtomicityActor-${Date.now()}`;

    const created = await auditService.auditedTransaction(
      prisma,
      { userId: seedManager.id, ipAddress: '203.0.113.7', userAgent: 'vitest' },
      (tx) => tx.role.create({ data: { name: roleName } }),
    );

    const auditRow = await prisma.auditLog.findFirst({
      where: { entityType: 'role', action: 'role.create', entityId: created.id },
    });

    expect(auditRow?.actorUserId).toBe(seedManager.id);
    expect(auditRow?.ipAddress).toBe('203.0.113.7');
    expect(auditRow?.userAgent).toBe('vitest');

    await prisma.role.delete({ where: { id: created.id } });
  });

  it('a mutation outside auditedTransaction is still captured, with no actor (trigger is unconditional)', async () => {
    const roleName = `AtomicityUnwrapped-${Date.now()}`;

    const created = await prisma.role.create({ data: { name: roleName } });

    const auditRow = await prisma.auditLog.findFirst({
      where: { entityType: 'role', action: 'role.create', entityId: created.id },
    });

    expect(auditRow).not.toBeNull();
    expect(auditRow?.actorUserId).toBeNull();

    await prisma.role.delete({ where: { id: created.id } });
  });
});
