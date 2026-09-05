# DEVELOPMENT_PLAN.md — Hub Lanka Pvt Limited

Twelve controlled vertical phases. **One phase per implementation session.** Never combine phases.
Each ends with a report and a stop.

**Sequencing note.** Phase 3 delivers the Rate Table *before* Phase 5 needs it for buying cost, and Phase 4
delivers the Cost Sheet before Phase 9 needs it for profit. Documents (Phase 7) come after Invoice because
several documents populate from billing data. Do not reorder without checking those dependencies.

---

## Phase 0 — Foundation

**Objective:** a deployable skeleton with the discipline in place.

**Scope:** pnpm workspaces + Turborepo · `apps/api` (NestJS 11, Node 24) · `apps/web` (React 19 + Vite) ·
`packages/shared` (Zod schemas, permission constants, enums) · TypeScript strict both sides ·
ESLint/Prettier · Docker Compose (api, web, postgres, redis) · Prisma initialised ·
error hierarchy · Pino logging with requestId · `/healthz` · CI (typecheck, lint, test, build).

**Database:** connection and migration tooling only. No business tables.
**Tests:** CI runs; one smoke test through the full stack.
**Acceptance:** `docker compose up` runs; a seeded page renders end to end; CI green on a PR.
**Risks:** monorepo tooling friction. Resolve here, not later.

**Status: COMPLETE (implementation + local verification).** `docker compose up --build` brings up
postgres, redis, api and web; the System Status page renders and confirms live database
connectivity through the running stack; typecheck, lint, unit tests, e2e smoke test and production
build all pass locally with the exact commands `.github/workflows/ci.yml` runs. The GitHub Actions
workflow itself has not yet been exercised on an actual PR — no remote/PR exists yet, and pushing
one is a step for whoever owns the repository, not taken unilaterally here. See the Phase 0
completion report for full detail, deviations and the technical decisions this phase required
(Prisma 7's driver-adapter/`prisma.config.ts` model, the `deepmerge-ts`/`mysql2` transitive CVE
overrides, the local-Postgres port collision on 5432, and others).

---

## Phase 1 — Authentication, RBAC and Audit foundation

**Objective:** real users log in; every mutation is already audited.

**Dependencies:** Phase 0.

**Database:** `user`, `role`, `permission`, `user_role`, `role_permission`, `refresh_token`, `audit_log`.
Audit table grants exclude UPDATE/DELETE.

**Backend:** Argon2id · login/refresh/logout · rotating refresh token in httpOnly cookie ·
`JwtAuthGuard` · `PermissionsGuard` failing closed on undeclared routes · `/me` ·
automatic audit capture · account lockout · user and role administration.

**Frontend:** login · auth context · protected routes · permission-conditional rendering · user admin.

**Seed:** Executive, Manager, Director roles and the full permission matrix from PRD §4.

**Tests:** permission-denied per endpoint · token refresh and revocation · lockout ·
**audit written inside the transaction** · no API path updates or deletes an audit row.

**Acceptance:** each role sees only its permitted navigation; an unauthorised call returns 403 server-side;
every create/update/delete produces an audit entry.

**Risks:** retrofitting audit later means touching every service again. It belongs here.

**Status: COMPLETE (implementation + local and Docker Compose verification).** Login/refresh/logout,
fail-closed permission enforcement, automatic audit capture, account lockout, the seeded PRD §4
permission matrix, and a minimal frontend auth flow are all built and verified — see the Phase 1
completion report for the full account, including technical decisions this phase required and one
notable deviation from this plan's original wording:

- **Automatic audit capture is a PostgreSQL trigger, not a Prisma Client extension** (this plan's
  §Backend line originally said "Prisma audit extension"). A Client extension was tried first and
  empirically failed: Node's `AsyncLocalStorage` context reliably survives a Prisma `create` call
  through the driver-adapter round trip but not `update`/`delete` — confirmed by direct repro, and
  would have silently broken audit capture for most real mutations (login lockout tracking, user
  deactivation, role unassignment are all UPDATE/DELETE). The trigger fires as part of the same
  statement/transaction by Postgres's own construction, with no dependency on any JS-level async
  context surviving the driver's internals, and is unconditional (cannot be bypassed by a forgotten
  wrapper either). See `apps/api/prisma/migrations/*_audit_capture_triggers/migration.sql` for the
  full account and `apps/api/src/audit/audit.service.ts` for how the app hands the trigger actor
  context via `SET LOCAL` session variables.
- The audit-log grant restriction required a **second, restricted Postgres role** (`hublanka_app`,
  `APP_DATABASE_URL`) distinct from the migration role — in Postgres, whichever role owns a table
  can always re-`GRANT` itself anything it `REVOKE`d, so the restriction only means something
  enforced against a different, non-owning role.
- `identity.user.manage` (user/role administration) is a new permission not present in PRD §4,
  granted to Manager only in the seed — flagged as an assumption, not a confirmed business rule.

---

## Phase 2 — Shipment Core

**Objective:** the Daily Shipment Schedule replaces the Excel sheet.

**Dependencies:** Phase 1.

**Database:** `shipment` with `shipment_no UNIQUE` + PostgreSQL sequence · `mawb_no` **indexed, not unique** ·
`house_awb_no` · `flight_date`, `handling_date`, `dep_time` · `cusdec_no` (hidden from grid) ·
`box_count`/`weight_kg` **nullable** · `status` enum · `version` for optimistic locking ·
`cancellation_request` · index on `(dep_date, dep_time)`.

**Backend:** shipment CRUD · ID allocation **inside the insert transaction** · status transition service
(single guarded entry point) · Completed locking (423) · optimistic concurrency (409) ·
delete with ownership + status checks (BR-46 to BR-49) · cancellation request and approval ·
schedule query defaulting to today+tomorrow sorted by DEP TIME · search by Shipment ID.

**Frontend:** schedule grid with the confirmed columns · `[View]` leftmost row action · Edit ·
**Copy MAWB** with toast · **Track** opening `https://hublanka.lk/tracking/` with `noopener,noreferrer` ·
Add/Edit form with 24-hour time picker and calendar picker · locked-state banner ·
conflict dialog · cancellation request modal · Manager approval queue · KPI row.

**Tests:** AC-01, AC-02, AC-03, AC-05, AC-06, AC-07, AC-08, AC-10, AC-11, AC-12.
Concurrent-insert test proving no duplicate Shipment ID.

**Acceptance:** create → edit → cancel → complete works per role; a Manager cannot delete another
Manager's shipment; a Completed shipment rejects edit and delete.

**Risks:** someone "fixing" the missing MAWB unique constraint. Guard it with a test asserting two
shipments may share a MAWB.

---

## Phase 3 — Cargo Handling, Master Data and Rate Table

**Objective:** BOX/WEIGHT capture, reference data, and weekly buying rates with history.

**Dependencies:** Phase 2.

**Database:** `shipper`, `consignee` (**with full addresses** — the CDN needs them), `airline`,
`commodity`, `airport` · `rate_table` with effective periods · `shipment.airline_id` (BR-58) ·
`shipment.applied_buying_rate` (the **value**, not just a reference).

**Backend:** master data CRUD with soft delete · commodity creation for Executive and Manager ·
Rate Table management (Manager) · **rate resolution by effective date** · buying rate captured at
shipment creation by the Manager · BOX/WEIGHT entry and edit while Pending.

**Frontend:** master data screens · commodity dropdown with inline "+ Add New Commodity" ·
Rate Table management UI · cargo handling form.

**Tests:** **AC-14 — changing this week's rate does not alter last week's shipment** ·
rate resolution at boundaries · commodity add permissions · soft delete of a referenced master record.

**Acceptance:** a shipment stores the rate value applied to it; historical profit is immune to later rate edits.

**Risks:** storing only a foreign key to the rate row. That would let an edited row rewrite history —
the exact failure BR-43 exists to prevent.

**Open:** OQ-1 (Rate Table dimensions). Build the confirmed shape; leave dimensions extensible.

---

## Phase 4 — Cost Sheet

**Objective:** operational expenses with the release → review → approve workflow.

**Dependencies:** Phase 3.

**Database:** `cost_sheet` (shipment ref, **S/N No** manual field, handling-date context, state
DRAFT/RELEASED/APPROVED, approver, approval signature/timestamp) · `cost_sheet_line` (11 fixed types, LKR, optional).

**Backend:** Executive prepare and **release** · Manager edit after release · Manager **approve** with
recorded signature · total calculation · state guards (cannot approve before release).

**Frontend:** Cost Sheet form reproducing the company layout · release action · Manager review and edit ·
approve action · approval/signature display.

**Tests:** AC-15 · total reconciles against the company sample (1,800.00 + 12,209.54 + 1,300 + 1,000 +
1,320 = **17,629.54**) · Executive cannot approve · approval recorded in audit.

**Acceptance:** the full workflow runs; approval is a state with a signature, not a display field.

---

## Phase 5 — Invoice

**Objective:** customer selling charges and the invoice document data.

**Dependencies:** Phase 4 (and Phase 3 for the buying rate).

**Database:** `invoice` (manual invoice number, invoice date, **Manager-set exchange rate**, term, due date,
gross weight, **chargeable weight**, currency) · `invoice_line` (description, weight basis, rate, currency,
USD amount, LKR amount) · line snapshot at issue.

**Backend:** invoice creation and editing (Manager) · **airline buying cost computation
= Chargeable Weight × the shipment's stored applied rate (BR-41, BR-66 — freight only)** ·
manual invoice number · manual exchange rate ·
charge lines with **per-line weight basis** (freight on chargeable, screening on gross, others flat) ·
totals in both currencies · due date from term · issue as an atomic transaction · idempotency key ·
immutability after issue.

**Frontend:** invoice form matching the company format · line editor · live totals · issue action.

**Tests:** **AC-13 — reproduce USD 2,482.09 / LKR 845,152.99 exactly** · precision test asserting the
screening rate computes at 0.021 not 0.02 · multi-currency and zero-quantity cases ·
**issue atomicity under forced mid-transaction failure** · issued invoice rejects edit.

**Acceptance:** the reference invoice reconciles to the cent; buying cost is computed from the shipment's
**stored** applied rate, not the current Rate Table value; no money value passes through a float anywhere.

**Risks:** the precision trap. Stored precision must exceed displayed precision or every total drifts.

---

## Phase 6 — Payments

**Objective:** partial payments through to fully paid.

**Dependencies:** Phase 5.

**Database:** `payment` (invoice ref, amount, date, method, reference, receipt file ref, recorded_by).

**Backend:** record payment (Manager) · receipt upload · **derived** remaining balance ·
fully-paid detection (BR-57) · guard preventing cumulative payments exceeding the invoice total ·
idempotency on payment recording.

**Frontend:** payment recording form · receipt upload · payment history · balance display ·
Director read-only payment view.

**Tests:** AC-16 · **AC-17 — full payment does not change shipment status** · over-payment rejected ·
receipt stored privately and served only to permitted roles.

**Acceptance:** partial payments accumulate; balance is accurate; payment and shipment lifecycles stay separate.

---

## Phase 7 — Documents, PDF generation and printing

**Objective:** all five documents, faithful to the company formats.

**Dependencies:** Phases 2–6 (documents populate from shipment, cargo and billing data).

**Database:** `shipment_document` (type, version, DRAFT/ISSUED, `field_data` jsonb for document-specific
manual fields, snapshot, stored file reference, issued_by/at).

**Backend:** template engine · **server-side readiness computation** returning missing fields ·
blocking rule (BR-07) · draft renders live from the shipment · issue freezes a version and stores the file ·
Puppeteer rendering **in the worker** with capped concurrency · `PrinterAdapter` with a PDF adapter ·
R2 storage.

**Frontend:** document tab section on the Shipment View · per-document view/edit · blocked-tab message ·
print and download actions · **no print action on the ADF**.

**Build order — easiest to hardest, deliberately:**
1. **AWB Sticker** — five fields; validates the whole populate-and-render pipeline cheaply. 12 × 8 cm.
2. **Security Clearance** — Hub Lanka's own format.
3. **ADF** — data capture and on-screen render; **no print path**. Carries dimensions, CBM, ULD/BT number,
   acceptance pallet number, which live nowhere else.
4. **AWB** — A4, carrier format, charge codes and SHC/HS fields.
5. **CDN** — A4, statutory SLPA layout; official-use sections print blank. Hardest, last.

**Tests:** AC-04, AC-18, AC-19, AC-20 · issued document immutable · shipment edit creates v2 ·
document file not retrievable without permission (direct-URL attempt).

**Acceptance:** each document matches the company's format and populates without re-keying.

**Open:** OQ-2 (Security Clearance paper size), OQ-3 (manual field lists). Build confirmed fields;
keep `field_data` extensible.

---

## Phase 8 — Tracking and Cut-off

**Objective:** operations are warned before cargo misses its flight.

**Dependencies:** Phase 2.

**Database:** `cutoff_alert` (state, raised, acknowledged, resolved) · actual departure capture (OQ-11).

**Backend:** worker cron evaluating `now ≥ departure − 5h` · state machine Normal → Approaching → Urgent →
Passed · **warning ends at actual flight departure, not at Completed status (BR-50)** ·
configurable thresholds · acknowledge action.

**Frontend:** cut-off indicator on the schedule row · countdown · acknowledge.

**Tests:** **AC-09** · alert fires exactly once per threshold **including across a worker restart** ·
warning persists when status becomes Completed but the flight has not departed.

**Acceptance:** the 5-hour warning behaves per BR-21 and BR-50.

**Risks:** the scheduler running in more than one process double-fires every alert. One process only.

**Open:** OQ-10 (whether readiness is also evaluated), OQ-11 (where actual departure is captured).

---

## Phase 9 — Analytics and Reports

**Objective:** Manager and Director reporting, including genuine profit.

**Dependencies:** Phases 3–6.

**Backend:** aggregate endpoints · SQL views for report definitions ·
**profit = revenue − buying cost − operational expenses** using each shipment's stored applied rate ·
dimensions: time, commodity, airline, shipper · export.

**Frontend:** Manager and Director dashboards · bar and pie charts with numbers alongside · filters · drill-through.

**Tests:** every KPI reconciles exactly with the underlying record list for the same filters ·
profit uses the **stored historical rate**, not the current one · currency resolution correct.

**Acceptance:** figures tie out; a rate change today does not move last month's reported profit.

**Open:** OQ-5 (exchange rate for resolving USD buying cost against LKR expenses in reporting).

---

## Phase 10 — Hardening, Security and E2E

**Objective:** the system is safe to put in front of real staff.

**Scope:** security review against ARCHITECTURE §24 with a **deliberate authorization-bypass attempt** ·
IDOR testing · upload abuse · rate limiting · full Playwright suite across all three roles ·
performance with production-sized data · index tuning · `pnpm audit`.

**Acceptance:** AC-21, AC-22 · no high-severity finding open · E2E green.

**Status: COMPLETE.** Full audit against the live repository (Phases 0–9), not a re-assertion of prior
claims — every REQUIREMENTS_TRACEABILITY.md row was checked against actual code and its cited test located
and run. Full suite green: 99 API unit + 140 API integration (`*.e2e-spec.ts`, real Postgres) + 35 web +
14 Playwright browser tests (new — `apps/e2e`, ARCHITECTURE §18's stated but previously unbuilt
requirement); typecheck/lint/format/production build green on all four packages; migration-from-zero
verified against a genuinely fresh, isolated Postgres 17 container. See the Phase 10 completion report and
REQUIREMENTS_TRACEABILITY.md §11 for the full account, including:

- **One requirement found incorrectly complete, fixed and re-verified:** BR-12 — a Cancelled shipment's
  core fields could still be silently edited (`ShipmentService#update` only blocked `COMPLETED`, not
  `CANCELLED`). Fixed; new regression test.
- **New hardening-only additions:** database `CHECK` constraints for every already-specified positive-value
  field (none existed before, despite ARCHITECTURE §5 stating the requirement since Phase 2); `api`/`worker`/
  `web` Docker images now run as an unprivileged user; the Playwright E2E suite itself; 8 e2e spec files'
  `afterAll` cleanup ordering fixed (missing `cutoffAlert` deletion before `shipment` deletion, which a
  real concurrently-running `CutoffCronService` could trip).
- **No known critical security defect remains.** One high-severity, currently unpatched-upstream transitive
  dependency vulnerability (`extract-zip`, via Puppeteer's install-time browser-fetch tooling only, not
  request-handling code) is tracked, not fixable in-repo — no patched version exists yet.

Phase 11 is not started.

---

## Phase 11 — Deployment, UAT and Production Readiness

**Objective:** live, with the company's data and staff.

**Scope:** Singapore-region deployment · nightly encrypted off-site backup ·
**restore tested in staging** · monitoring, Sentry, uptime, `job_run` visibility · runbook ·
training materials · **parallel run against the existing manual process** · defect triage · cutover.

**Acceptance:** a restore has actually been performed · real shipments processed end to end ·
sign-off from a user in each role.

**Risks:** an untested backup. Do not go live without a completed restore.

---

## Dependency graph

```
0 ─▶ 1 ─▶ 2 ─▶ 3 ─▶ 4 ─▶ 5 ─▶ 6 ─▶ 7 ─▶ 9 ─▶ 10 ─▶ 11
          │                                   ▲
          └──────────▶ 8 ─────────────────────┘
```

Phase 8 depends only on Phase 2 and may run in parallel with 4–7 if capacity allows.
Nothing else should be parallelised.
