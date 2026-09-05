# ARCHITECTURE.md — Hub Lanka Pvt Limited

**Describes HOW the system is built.** Subordinate to `PRD.md` and `CONTEXT.md`.
No production application code. Structures and decisions only.

---

## 1. Overall architecture

**Modular monolith + one worker process.** Two deployables, not one, not twelve.

```
Browser (Executive · Manager · Director)
        │ HTTPS
        ▼
React 19 SPA (Vite, static build)
        │ REST /api/v1
        ▼
Nginx/Caddy — TLS · gzip · rate limiting
        ▼
NestJS 11 API (Node 24 LTS)
  guards → validation → controllers → services → repositories
        │
        ├──▶ PostgreSQL 17 (Prisma 7)
        ├──▶ Cloudflare R2 (documents, receipts)
        └──▶ Redis ──▶ Worker (cron · PDF · outbox · cut-off)
```

**Why not microservices:** completing a shipment writes the shipment, a status change, an audit row and
possibly notification rows — atomically. Distributed, that becomes a saga with compensating actions for a
company doing tens of shipments a day. The scale does not justify the failure modes.

**Why the worker is separate:** Puppeteer is memory-heavy and must not stall API requests; and a scheduler
running inside two API replicas fires every cut-off alert twice.

## 2. Modular monolith boundaries

Modules communicate only through each other's **public service interfaces**. Never reach into another
module's repository.

| Module | Owns |
|---|---|
| `identity` | Users, roles, permissions, sessions, refresh tokens |
| `masterdata` | Shippers, consignees, airlines, commodities, airports |
| `shipment` | Shipment record, status transitions, schedule queries, locking |
| `cargo` | BOX/WEIGHT capture, cargo handling |
| `rates` | Rate Table, effective periods, rate resolution |
| `costsheet` | Expense lines, release → review → approve workflow |
| `invoice` | Charge lines, exchange rate, totals |
| `payment` | Payments, receipts, balance derivation |
| `documents` | The five documents, templates, generation, versioning |
| `printing` | Printer adapters (Zebra, PDF) |
| `cutoff` | Warning evaluation and state |
| `analytics` | Aggregate reporting |
| `audit` | Append-only audit log |
| `notification` | In-app + email outbox |

## 3. Frontend architecture

Feature-folder structure mirroring backend modules. Route groups per role.

```
apps/web/src/
├── app/           router, providers, layouts, role route-groups
├── features/      shipments/ costsheet/ invoice/ payments/ documents/ analytics/ ...
│   └── <feature>/{api,components,hooks,pages,types}
├── components/ui/     shadcn primitives
├── components/shared/ DataTable · StatusBadge · CutoffIndicator · MoneyInput
│                      DateTimePickers · FileUpload · DocumentTabs · BrandMark
├── public/assets/branding/  official Hub Lanka logo assets
└── lib/           apiClient · auth · permissions · formatters
```

- **Branding**: the FFMS uses the company's official logo, sourced from the public
  site (hublanka.lk) and stored verbatim (unmodified) under
  `apps/web/public/assets/branding/`. `components/shared/BrandMark.tsx` is the single
  place that pairs the logo with the "Hub Lanka" wordmark and system name — reused in
  the header and the login page rather than duplicating markup per screen. The FFMS UI
  is intentionally distinct from the public marketing site: it reuses only the logo and
  color accents, not the marketing site's layout or components.
- **TanStack Query v5** owns server state; polling (20–30 s) delivers schedule freshness. No WebSockets.
- **Zustand** only for genuine client state: auth/permission context, saved table views, filters.
- **React Hook Form + Zod**, with schemas imported from `packages/shared` — one definition, both sides.
- **TanStack Table v8** for every grid; server-side sort, filter and pagination throughout.
- **Money never becomes a JS `number`.** Decimal strings from the API, formatted for display,
  never arithmetic in the browser.
- Permission-conditional rendering is **presentation only**. It is never the access control.

## 4. Backend architecture

```
Request
  → requestId middleware
  → JwtAuthGuard
  → PermissionsGuard        @RequirePermission('invoice.issue') — fails closed if undeclared
  → ZodValidationPipe
  → Controller              parse, delegate, format. No business logic.
  → Service                 ALL business rules; owns the transaction
  → Repository              data access only (Prisma)
  → Adapters                storage · printer · mail · pdf
```

**A controller containing an `if` about business state is a defect.** That rule is what keeps the business
rules testable and in one place.

## 5. Database architecture

PostgreSQL 17. Principles rather than a schema — the schema is Phase 0/2 work.

- Money `NUMERIC`; weights `NUMERIC(10,3)`; timestamps `timestamptz` UTC, displayed `Asia/Colombo`.
- **Rate values stored with higher precision than displayed** (PRD §8).
- Foreign keys and CHECK constraints **in the database**, not only in application code.
- `shipment_no` carries a `UNIQUE` index, allocated from a **PostgreSQL sequence inside the insert
  transaction**. Never generated in application code, never client-side, never from a row count.
- **`mawb_no` gets a plain index and no unique constraint** (BR-03). This is deliberate and must not be
  "fixed" by a well-meaning future migration.
- Master data is soft-deleted (`is_active`) because history references it.
- Indexes for the known access patterns: `(dep_date, dep_time)` for the default schedule view,
  `shipment_no`, `mawb_no`, `status`, and the analytics grouping columns.

## 6. Prisma strategy

- `schema.prisma` is the single schema definition and doubles as living documentation.
- Migrations are **versioned, committed and reviewed** — every generated migration is read before merge.
- **Additive within a release**: add column → backfill → switch code → drop in a *later* release.
  Then an application rollback never requires a database rollback.
- Reporting queries use `$queryRaw` with bound parameters, or SQL views. Do not contort the query builder
  for analytics.
- Money columns map to `Decimal`. Use the decimal type end to end; never coerce to `number`.

## 7. API architecture

REST, `/api/v1`, OpenAPI generated by `@nestjs/swagger` from the actual DTOs so documentation cannot drift.

- **Named state transitions**, not generic status patches: `POST /shipments/:id/complete`,
  `/cancellation-request`, `/costsheets/:id/release`, `/costsheets/:id/approve`, `/invoices/:id/issue`.
  Transitions carry rules and side effects; naming them makes each individually guardable.
- Errors: `{ error: { code, message, details? } }` with stable machine codes. Business-rule violations → 422.
  Locked shipment → 423. Concurrency conflict → 409.
- Pagination `?page&pageSize` → `{ data, meta }`, `pageSize` capped.
- **Idempotency-Key** honoured on invoice issue, payment recording and document issue — the double-click
  that creates two invoices is a real incident, not a hypothetical.
- Swagger UI on staging; disabled or authenticated in production.

## 8. Authentication

Argon2id hashing. Short-lived JWT access token held in memory; **rotating refresh token in an httpOnly,
Secure, SameSite=Strict cookie**, hashed server-side so sessions are revocable.

**Never `localStorage`.** That is the standard failure of "use JWT" and it makes any XSS a total account
compromise with no revocation path.

Account lockout after repeated failures. Sessions invalidated on role change, password change or deactivation.

## 9. RBAC

```
user ─< user_role >─ role ─< role_permission >─ permission   (all rows in the database)
```

Permission strings: `<module>.<entity>.<action>[.scope]` — `shipment.delete.own`, `costsheet.approve`,
`invoice.exchange_rate.set`, `rate.table.manage`.

**Three enforcement layers, all server-side:**

1. **Route guard** — reads `@RequirePermission(...)` metadata; **fails closed** when a route declares none,
   so a forgotten declaration breaks the endpoint rather than opening it.
2. **Ownership/scope checks in the service** — `shipment.delete.own` requires
   `shipment.created_by === user.id`, plus `status !== 'Completed'` (BR-46 to BR-49). Ownership is a
   *service* rule, not just a permission string.
3. **Response field stripping** — financial fields removed server-side for roles lacking them.

Permissions live in the database because the role model has already changed several times during
requirements gathering. Remapping must be configuration, not a sprint.

## 10. Audit logging

Two layers, deliberately:

1. **Automatic** — a Prisma client extension writes a before/after diff on every mutation. Cannot be forgotten.
2. **Explicit** — services write semantic entries for business events: completion approval, cancellation
   approval, buying-rate entry, Cost Sheet approval, invoice issue, payment recording, deletion.

Append-only, enforced at the **grant level**: the application's database role holds `INSERT` and `SELECT`
on `audit_log` only. No `UPDATE`, no `DELETE`. An application bug then cannot destroy the trail.

Written **inside the same transaction** as the change it records.

## 11. Document generation

```
DocumentTemplate (HTML + CSS, one per document type, isolated from business logic)
        ↓  populated from the Shipment record + document-specific manual fields
DRAFT   — renders live from the Shipment; stores no copy of shipment data
        ↓  on issue (print/download)
ISSUED  — shipment values snapshotted, rendered file stored in R2, version frozen
```

Editing a shipment afterwards creates a **new draft version**. The issued version is never altered or
deleted — a printed business document must render identically forever.

| Document | Engine | Output |
|---|---|---|
| Security Clearance | Puppeteer HTML→PDF | size OPEN (OQ-2) |
| AWB Sticker | HTML with `@page { size: 12cm 8cm }` + bwip-js if a barcode is required | Zebra ZD420 |
| ADF | On-screen render only | **no print path** |
| AWB | Puppeteer HTML→PDF | A4 |
| CDN | Puppeteer HTML→PDF | A4 |

Templates live in their own directory and contain **no business logic** — they receive a prepared view model.
Formats are statutory or carrier-controlled; layout changes are a business decision, not a developer one.

Rendering happens **only in the worker**, with concurrency capped (1–2 Chromium contexts) and a render timeout.

## 12. File storage

Cloudflare R2 (S3-compatible), behind a `StorageService` interface with a local-disk adapter for development.

Private by default. Randomised storage keys, never the user's filename. Served through an authenticated,
permission-checked endpoint or a short-lived signed URL. MIME + magic-byte validation, size cap,
`sha256` stored for tamper evidence.

Stored: issued document PDFs, payment receipts, any shipment attachments.

## 13. Zebra printing abstraction

```
PrinterAdapter (interface)
  ├── PdfPrinterAdapter        browser print path — works from day one
  └── ZebraZD420Adapter        cable connection, 12 × 8 cm
```

Printer settings (adapter type, connection, label dimensions) live in configuration, not code.
The exact protocol is implementation-level and may be resolved during Phase 7; **nothing above the adapter
boundary changes** when it is. Business and document logic never reference a printer directly.

## 14. Transaction strategy

Every state change is one transaction. Non-negotiable groupings:

| Operation | Written atomically |
|---|---|
| Create shipment | shipment + sequence allocation + audit |
| Complete shipment | status + approval record + audit |
| Cancel shipment | status + cancellation record with reason + audit |
| Approve Cost Sheet | approval state + signature record + audit |
| Issue invoice | invoice + lines + snapshot + audit (+ notification outbox) |
| Record payment | payment + receipt reference + audit |
| Issue document | version freeze + snapshot + stored file reference + audit |

**Delete tension — flagged, not resolved.** BR-46 to BR-49 permit a Manager to delete their own
non-Completed shipment. `DEVELOPMENT_RULES.md` forbids hard-deleting financially or legally significant
records. A shipment with an issued invoice, a recorded payment or a signed Security Clearance is such a
record. **OQ-9 in PRD §12.** Until answered, implement delete as **soft delete with a full audit entry**,
and surface the question rather than silently choosing hard delete.

## 15. Background workers

`@nestjs/schedule` + BullMQ/Redis in one dedicated worker process.

| Job | Cadence | Notes |
|---|---|---|
| Cut-off evaluation | every 5 min | Clock-driven; needs no external API |
| Email outbox | every 30 s | DB outbox with retry and visible failures |
| PDF rendering | on demand | Concurrency capped |
| Overdue invoice sweep | daily | |

**The scheduler runs in exactly one process.** Two API replicas each running cron double-fire every alert.

## 16. Notifications

In-app (database table + polling) and email (Nodemailer + SMTP), driven by a **DB outbox** written in the
same transaction as the triggering event. Never send inside a request handler — a transient SMTP failure
would silently lose the message while telling the user it succeeded.

Cut-off warnings escalate; every alert carries an owner role and an acknowledge action.

## 17. Analytics

SQL aggregates over the operational database — no separate warehouse at this volume. Views for report
definitions so a report change is not a code change. Recharts on the frontend.

**Every dashboard figure must drill through to the underlying records and reconcile exactly.**
A KPI that doesn't tie out to its own list is a defect.

Dimensions: time (day/week/month/year) · commodity · airline (from the stored field, BR-58) · shipper ·
financial (revenue, buying cost, operational expenses, profit).

## 18. Testing

| Level | Tool | Scope |
|---|---|---|
| Unit | Vitest | Money and weight arithmetic, status transitions, permission resolution, cut-off timing, rate resolution |
| Integration | Vitest + Supertest, real Postgres (`apps/api/test/*.e2e-spec.ts`) | Every mutating endpoint, each with a permission-denied case |
| Component | Vitest + Testing Library | DataTable, DocumentTabs, CutoffIndicator, forms |
| E2E | Playwright (`apps/e2e`) | Critical flows across all three roles — real browser against a fully running stack |

Phase 10 note: only `audit-log-grants.e2e-spec.ts` actually provisions a fresh **Testcontainers** Postgres
(it needs its own, differently-privileged database role) — every other `*.e2e-spec.ts` file connects to
whatever `DATABASE_URL`/`APP_DATABASE_URL` already points at (the docker-compose Postgres in local dev,
the CI Postgres service container in CI), not a per-file ephemeral instance. This is a real deviation from
this table's original intent and was not previously flagged; it worked without incident because both
environments always provide a real, already-migrated Postgres, but it does mean local runs share state
with anything else pointed at that same database (see the Phase 10 report's "Remaining risks").

**100 % coverage on money and weight code.** ≥80 % on services.

Reference fixture: the company's real invoice (PRD §8). Profit and invoice arithmetic reproduce
`USD 2,482.09` exactly; the LKR total reproduces as `845,152.98`, one cent below PRD §8's literal
`845,152.99` — a known, already-documented rounding gap in the one real Security-line specimen
(`/references/README.md` discrepancy §2), not a defect, and not silently forced to match.

## 19. Error handling

One `AppError` hierarchy — `ValidationError`, `NotFoundError`, `ForbiddenError`, `BusinessRuleError`,
`ConflictError`, `LockedError` — mapped centrally to HTTP codes. No bare `throw new Error()` in business code.

Business-rule violations return a stable machine code so the UI shows the real message
(*"Cannot generate document. Please enter Box and Weight information."*) rather than a generic failure.

## 20. Concurrency

Optimistic locking on the shipment via a `version` column: `UPDATE ... WHERE id = ? AND version = ?`.
Zero rows affected → **409** with the confirmed message:
*"This shipment was updated by another user. Please review the latest information before saving."*

Never last-write-wins on a record that feeds legal documents and financial calculations.

## 21. Migration strategy

Versioned Prisma migrations, additive within a release, reviewed before merge, applied by CI before the
application deploys. Multi-step changes (add nullable → backfill → set not-null) are split by hand.

## 22. Deployment

Docker Compose — `web` (static) · `api` · `worker` · `postgres` · `redis` · reverse proxy.
Deploy to an **Asia-Pacific region (Singapore)**; a US or EU region adds 200–300 ms to every request and
the application will feel broken to Sri Lankan users regardless of how well it is built.

Nightly encrypted `pg_dump` off-site. **A restore must be tested before go-live** — an untested backup is
not a backup.

## 23. Observability

Pino structured JSON logs with a `requestId` correlating API → worker. Sentry for errors.
Uptime monitoring on `/healthz`.

`job_run` table recording every worker job's start, finish and duration — **a silently dead cron is the
worst failure mode here**, because cut-off warnings stop and nobody notices until a shipment is rolled.

Never log tokens, passwords or full financial payloads.

## 24. Security

TLS 1.2+ · Helmet + CSP · `@nestjs/throttler` (aggressive on auth) · explicit CORS allowlist ·
CSRF protection on cookie-authenticated routes · parameterised queries only ·
upload validation by magic bytes · environment variables validated with Zod at boot (fail fast) ·
`pnpm audit` in CI.

The three defects most likely to appear in a system of this shape, and therefore explicit code-review
checklist items: **authorization checked in React but not on the server** · **tokens in localStorage** ·
**uploaded files served from a public path**.

`api`/`worker`/`web` run as an unprivileged container user, not root (Phase 10 hardening —
`apps/api/Dockerfile`, `apps/web/Dockerfile`). Upgrading an environment that already ran the old
root-owned image against a populated `api_storage` volume needs a one-time
`docker compose run --rm --user root worker chown -R 1001:1001 /repo/storage-local` — see that
Dockerfile's comment.

Every positive-value field PRD §7 already specifies as validated (box count, weight, buying rate,
invoice chargeable weight/exchange rate, invoice line amounts, cost sheet line amounts, payment amount)
has a matching database `CHECK` constraint as of Phase 10
(`apps/api/prisma/migrations/20260904190000_hardening_check_constraints`) — §5's requirement existed
from Phase 2 but nothing had actually added one until this hardening pass closed the gap.

## 25. Data integrity

- One central Shipment record; documents reference it rather than copying it (BR-35).
- Snapshots only where PRD §8 and CONTEXT §23 require them: applied buying rate, issued document content,
  invoice lines at issue.
- Derived values computed, never stored: remaining balance, totals, profit.
- Historical financial values never silently change — enforced by test (AC-14).
