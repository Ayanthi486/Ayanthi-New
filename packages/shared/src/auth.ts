import { z } from 'zod';

/**
 * The three fixed system roles (CONTEXT.md §6). Structural, not
 * runtime-editable — a fourth role is not a confirmed requirement.
 */
export const ROLE_NAMES = ['Executive', 'Manager', 'Director'] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

/**
 * Every permission string the system knows about, `<module>.<entity>.<action>[.scope]`
 * (ARCHITECTURE §9), translated 1:1 from the PRD §4 permission matrix plus
 * the Phase 1 `identity.user.manage` infrastructure gap (see
 * DEVELOPMENT_PLAN Phase 1 report — PRD §4 has no "manage users" row).
 * Which roles hold which of these is seed data (apps/api/prisma/seed.ts),
 * not hardcoded here — this list only defines the vocabulary, both sides
 * import it so the string set is defined exactly once (DEVELOPMENT_RULES §6).
 */
export const PERMISSION_KEYS = [
  'shipment.create',
  'shipment.update',
  'shipment.delete.own',
  // Direct status-change dropdown (Schedule grid). Base grants Pending/
  // Confirmed/Cancelled/Departed; .payment additionally unlocks Payment
  // Pending/Payment Received. Replaces the old cancellation-request/approve
  // and completion-approve workflow entirely.
  'shipment.status.update',
  'shipment.status.payment',
  'cargo.boxweight.enter',
  'rate.buying.enter',
  'rate.table.manage',
  'shipment.handling_date.manage',
  'costsheet.prepare',
  'costsheet.edit_released',
  'costsheet.approve',
  // Once Approved, only a Manager may still edit — Executive is locked out
  // (Executive's costsheet.prepare stops granting edit access at this stage).
  'costsheet.edit_approved',
  'costsheet.view',
  'invoice.manage',
  'invoice.exchange_rate.set',
  'invoice.number.enter',
  'payment.record',
  'invoice.view',
  'invoice.view.readonly',
  'payment.view',
  'payment.view.readonly',
  'documents.manage',
  'documents.view.readonly',
  // Security Clearance/AWB Sticker/CDN are Executive-only — nobody else can
  // view or manage them, not even Manager/Director's broader documents.*
  // grants above.
  'documents.basic.manage',
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
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** A plain HTML input submits "" when left blank — see shipment.ts's identical helper. */
const optional = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), inner.optional());

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** The authenticated user shape returned by both POST /auth/login and GET /me. */
export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  // Whether a profile photo is set — never the image itself or a public
  // URL. The client fetches the actual bytes from GET /me/avatar as an
  // authenticated request (ARCHITECTURE §12: never a public bucket/link).
  hasAvatar: z.boolean(),
  // Whether a signature image is set, fetched from GET /me/signature
  hasSignature: z.boolean(),
  // National Identity Card number, self-service editable via Profile — used
  // to auto-populate the Security Clearance certificate's NIC field.
  idCardNo: z.string().nullable(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  user: authUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
});
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

export const meResponseSchema = authUserSchema;
export type MeResponse = AuthUser;

/** PATCH /me — self-service profile update. Email and role are read-only here (role is admin-managed, /users). */
export const updateProfileRequestSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  idCardNo: optional(z.string().trim().min(1)),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

// --- User & role administration (identity.user.manage) -------------------

export const adminRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  permissions: z.array(z.string()),
});
export type AdminRole = z.infer<typeof adminRoleSchema>;

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  isActive: z.boolean(),
  roles: z.array(z.object({ id: z.string(), name: z.string() })),
  createdAt: z.string(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const createUserRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1),
  roleIds: z.array(z.string()).min(1, 'At least one role is required'),
});
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

export const updateUserRequestSchema = z.object({
  fullName: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

export const assignRoleRequestSchema = z.object({
  roleId: z.string(),
});
export type AssignRoleRequest = z.infer<typeof assignRoleRequestSchema>;
