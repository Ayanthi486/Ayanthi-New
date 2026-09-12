/**
 * Seeds the three fixed roles, the full PRD §4 permission matrix, and a
 * dev-only user per role. Idempotent — safe to re-run in CI/Docker (upserts
 * by unique key/name; role grants are replaced wholesale each run so the
 * seed is always the source of truth for who holds what).
 *
 * Connects via DATABASE_URL (the privileged/migration role) — invoked by
 * the Prisma CLI right after migrations, in the same environment that
 * already has that variable set. Deliberately a plain, non-extended
 * PrismaClient: seeding roles/permissions/users doesn't need the audit
 * extension (nothing here is a business mutation to trace), and requiring
 * an AuditService/Nest DI container just to run a one-shot seed script
 * would be a needless abstraction.
 */
import * as argon2 from 'argon2';
import { PERMISSION_KEYS, ROLE_NAMES, type PermissionKey, type RoleName } from '@hub-lanka/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './../src/generated/prisma/client';

const ROLE_PERMISSIONS: Record<RoleName, PermissionKey[]> = {
  Executive: [
    'shipment.create',
    'shipment.update',
    'shipment.status.update',
    'cargo.boxweight.enter',
    'costsheet.prepare',
    'costsheet.view',
    'documents.manage',
    // Security Clearance/AWB Sticker/CDN — Executive-only, not granted to
    // Manager or Director below.
    'documents.basic.manage',
    'cutoff.acknowledge',
    'masterdata.commodity.create',
    'masterdata.airport.create',
    'masterdata.airline.create',
    'masterdata.flight.create',
    'masterdata.shipper.create',
    'masterdata.consignee.create',
    'masterdata.view',
    'shipment.view',
    'shipment.mawb.copy',
    'shipment.track',
  ],
  Manager: [
    'shipment.create',
    'shipment.update',
    'shipment.delete.own',
    'shipment.status.update',
    'shipment.status.payment',
    'cargo.boxweight.enter',
    'rate.buying.enter',
    'rate.table.manage',
    'shipment.handling_date.manage',
    'costsheet.prepare',
    'costsheet.edit_released',
    'costsheet.approve',
    // Direct request: after Approved, only Manager may still edit — Executive
    // loses edit access entirely once a Cost Sheet is Approved.
    'costsheet.edit_approved',
    'costsheet.view',
    'invoice.manage',
    'invoice.exchange_rate.set',
    'invoice.number.enter',
    'payment.record',
    'invoice.view',
    'payment.view',
    'documents.manage',
    'cutoff.acknowledge',
    'masterdata.commodity.create',
    'masterdata.airport.create',
    'masterdata.airline.create',
    'masterdata.flight.create',
    'masterdata.shipper.create',
    'masterdata.consignee.create',
    'masterdata.manage',
    'masterdata.view',
    'shipment.view',
    'shipment.mawb.copy',
    'shipment.track',
    'analytics.view',
    'identity.user.manage',
  ],
  Director: [
    'shipment.create',
    'invoice.view.readonly',
    'payment.view.readonly',
    'documents.view.readonly',
    'costsheet.view',
    'masterdata.view',
    'shipment.view',
    'shipment.mawb.copy',
    'shipment.track',
    'analytics.view',
  ],
};

// Dev-only accounts so `docker compose up` / local dev is immediately
// usable. NOT a production seeding default — see the Phase 1 report. Their
// @hublanka.dev email is what actually marks them as dev/test data
// internally; `fullName` deliberately uses a realistic-looking (not a real
// person's) display name rather than a "Dev X" label — the profile UI is a
// production-facing surface, and a dev/demo screenshot of it should look
// like the real thing, not expose an internal testing convention as if it
// were part of the user-facing identity system.
const DEV_SEED_PASSWORD = 'DevPassword123!';
const DEV_SEED_USERS: { email: string; fullName: string; role: RoleName }[] = [
  { email: 'executive@hublanka.dev', fullName: 'Priyantha Jayasuriya', role: 'Executive' },
  { email: 'manager@hublanka.dev', fullName: 'Chamari Wickramasinghe', role: 'Manager' },
  { email: 'director@hublanka.dev', fullName: 'Nimal Rathnayake', role: 'Director' },
];

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run the seed script');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  try {
    const roleIdByName = new Map<RoleName, string>();
    for (const name of ROLE_NAMES) {
      const role = await prisma.role.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      roleIdByName.set(name, role.id);
    }

    const permissionIdByKey = new Map<PermissionKey, string>();
    for (const key of PERMISSION_KEYS) {
      const permission = await prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key },
      });
      permissionIdByKey.set(key, permission.id);
    }

    for (const roleName of ROLE_NAMES) {
      const roleId = roleIdByName.get(roleName);
      if (!roleId) continue;

      // Grants are replaced wholesale so the seed stays the single source
      // of truth — a permission removed from ROLE_PERMISSIONS above is
      // actually revoked on the next seed run, not left stale.
      await prisma.rolePermission.deleteMany({ where: { roleId } });
      for (const permissionKey of ROLE_PERMISSIONS[roleName]) {
        const permissionId = permissionIdByKey.get(permissionKey);
        if (!permissionId) continue;
        await prisma.rolePermission.create({ data: { roleId, permissionId } });
      }
    }

    const passwordHash = await argon2.hash(DEV_SEED_PASSWORD, { type: argon2.argon2id });
    for (const seedUser of DEV_SEED_USERS) {
      const roleId = roleIdByName.get(seedUser.role);
      if (!roleId) continue;

      const user = await prisma.user.upsert({
        where: { email: seedUser.email },
        update: { fullName: seedUser.fullName },
        create: { email: seedUser.email, fullName: seedUser.fullName, passwordHash },
      });

      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        update: {},
        create: { userId: user.id, roleId },
      });
    }

    console.log(
      `Seeded ${ROLE_NAMES.length} roles, ${PERMISSION_KEYS.length} permissions, ${DEV_SEED_USERS.length} dev users.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
