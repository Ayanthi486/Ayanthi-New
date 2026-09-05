# REQUIREMENTS_TRACEABILITY.md — Hub Lanka Pvt Limited

Every confirmed business requirement mapped to where it is specified, where it is built, when, and how it
is proven. **Purpose: no business requirement disappears during implementation.**

Review this at the end of every phase. If a row's phase has shipped and its test does not exist, the phase
is not complete.

---

## 1. Shipment identity and core

| BR | Requirement | PRD | Architecture | Phase | Test |
|---|---|---|---|---|---|
| BR-01 | All three roles create shipments | §4, §6 | shipment | 2 | Permission test per role |
| BR-02 | Shipment ID `HUB 000001`, unique, DB-enforced | §6, §7 | §5 sequence in transaction | 2 | **AC-01** concurrent insert |
| BR-03 | MAWB manual, **not unique** | §6, §7 | §5 index, no constraint | 2 | **AC-02** + regression guard |
| BR-04 | House AWB manual, never generated | §6 | shipment | 2 | Field validation |
| BR-05 | Saveable without BOX/WEIGHT | §6 | shipment nullable | 2 | **AC-03** |
| BR-06 | Executive enters BOX/WEIGHT at handling | §6 | cargo | 3 | Permission + edit test |
| BR-13 | Flight Date and Handling Date separate | §6 | shipment | 2 | Schema + usage test |
| BR-18 | BOX is the internal term | §6 | shipment | 2 | Naming review |
| BR-19 | CUSDEC stored, hidden from grid | §6 | shipment | 2 | Grid column test |
| BR-51 | Shipment ID and S/N No coexist | §6 | costsheet | 4 | Cost Sheet field test |
| BR-58 | Airline is a stored field | §6 | shipment, masterdata | 3 | Analytics grouping test |

## 2. Lifecycle, status and deletion

| BR | Requirement | PRD | Architecture | Phase | Test |
|---|---|---|---|---|---|
| BR-08 | Three statuses only | §5.1, §6 | shipment enum | 2 | Transition test |
| BR-09 | Completed requires Manager approval | §6 | §7 named transition | 2 | Permission + approval test |
| BR-10 | Completed is locked | §6 | 423 Locked | 2 | **AC-12** |
| BR-11 | Cancellation needs reason + Manager approval | §6 | cancellation_request | 2 | **AC-10** |
| BR-12 | Cancel ≠ Delete; cancelled retained | §6 | shipment | 2 (locking gap fixed 10) | Retention test + Phase 10 "Cancelled locking" regression test |
| BR-46 | Manager cannot delete another Manager's | §4, §6 | §9 service ownership | 2 | **AC-11** |
| BR-47 | Manager cannot delete Exec/Director's | §4, §6 | §9 service ownership | 2 | **AC-11** |
| BR-48 | Executive and Director cannot delete | §4, §6 | §9 guard | 2 | Permission test |
| BR-49 | Completed cannot be deleted | §6 | §9 service | 2 | **AC-12** |
| BR-67 | Four lifecycles stay distinct | §5.1, §6 | §14 | 2, 6 | **AC-17** |

## 3. Schedule, UI and operations

| BR | Requirement | PRD | Architecture | Phase | Test |
|---|---|---|---|---|---|
| BR-15 | Today + Tomorrow, sorted by DEP TIME | §5.2 | §5 index | 2 | **AC-05** |
| BR-16 | 24-hour time picker, calendar picker | §5.2 | §3 | 2 | Component test |
| BR-17 | Commodity DB-backed, Exec+Mgr may add | §6 | masterdata | 3 | Permission test |
| BR-21 | Cut-off warning starts at 5 hours | §5.5 | cutoff | 8 | **AC-09** |
| BR-50 | Warning ends at **actual departure** | §5.5 | cutoff | 8 | **AC-09** + Completed-but-not-departed case |
| BR-22 | Track opens company URL in new tab | §5.2 | §3 | 2 | **AC-08** |
| BR-23 | Excluded schedule columns | §5.2 | §3 | 2 | Grid test |
| BR-24 | View is a leftmost row action | §5.2 | §3 | 2 | Component test |
| BR-20 | Shift Leader is not a role | §3 | identity | 1 | Role seed review |
| BR-37 | Four Managers, individual accounts | §3 | identity | 1 | Seed test |
| — | Copy MAWB with confirmation | §5.2 | §3 | 2 | **AC-07** |
| — | Optimistic concurrency | §5.2 | §20 | 2 | 409 conflict test |

**Reference artifact.** The real Daily Shipment Schedule is `/references/company-process/shedule.jpg` —
check it before building or changing the schedule grid's columns, order, or terminology (BR-15, BR-16,
BR-23).

## 4. Financial

| BR | Requirement | PRD | Architecture | Phase | Test |
|---|---|---|---|---|---|
| BR-38 | Profit = revenue − buying cost − opex | §8 | analytics | 9 | Reconciliation test |
| BR-39 | Buying rate is weight-based | §8 | rates | 3 | Calculation test |
| BR-41 | Buying cost uses Chargeable Weight | §8 | rates, invoice | 5 | Calculation test |
| — | Buying cost computed from the shipment's **stored** applied rate | §8 | §25 | 5 | **AC-14** + Phase 5 acceptance |
| BR-42 | Buying rate in USD | §8 | rates | 3 | Currency test |
| BR-43 | Weekly rate; history preserved | §8 | §25 snapshot | 3 | **AC-14** |
| BR-44 | Manager enters rate at booking | §4, §8 | rates | 3 | Permission test |
| BR-45 | Rate Table with effective periods | §8 | rates | 3 | Resolution boundary test |
| BR-66 | No buying cost on non-freight lines | §8 | invoice | 5 | Calculation test |
| BR-40 | Selling charges manually entered | §8 | invoice | 5 | Form test |
| BR-30 | Weight breaks handled manually | §8 | invoice | 5 | No auto-calc assertion |
| BR-52 | Invoice number manual | §6 | invoice | 5 | No auto-generation test |
| BR-53 | Manager sets exchange rate | §4, §6 | invoice | 5 | Permission test |
| BR-27 | Managers create invoices, Director views | §4 | invoice | 5 | Permission test |
| BR-32 | Cost Sheet = internal expenses | §6 | costsheet | 4 | Line-type test |
| BR-14 | Cost Sheet uses Handling Date | §6 | costsheet | 4 | Context test |
| BR-59 | Executive releases Cost Sheet | §5.3 | costsheet | 4 | **AC-15** |
| BR-60 | Manager edits after release | §5.3 | costsheet | 4 | **AC-15** |
| BR-61 | Manager approves with signature | §5.3 | costsheet | 4 | **AC-15** |
| — | Precision exceeds display | §8 | §5, §6 | 5 | **AC-13** screening 0.021 |
| — | Reference invoice reconciles | §8 | invoice | 5 | **AC-13** exact totals |

**Reference artifacts.** The real Cost Sheet form is `/references/company-process/cost_sheet.jpeg`
(BR-32, BR-14, BR-59–BR-61) — see `/references/README.md`'s "Discrepancies found" §4–§5 for gaps already
found against the current Phase 4 implementation (fuller line-label wording; a distinct "Shift Leader Name"
header field the schema doesn't yet have). The real Invoice is `/references/company-process/invoice.pdf`
(the AC-13 rows above) — see discrepancies §1–§3 for the resolved per-line rounding model, the unverifiable
Security Charges 36.2594 precision, and footer content (bank-transfer block, payment terms, due date) that
PRD.md does not currently mention.

## 5. Payments

| BR | Requirement | PRD | Architecture | Phase | Test |
|---|---|---|---|---|---|
| BR-54 | Partial payments | §5.4 | payment | 6 | **AC-16** |
| BR-55 | Payment date stored | §5.4 | payment | 6 | Field test |
| BR-56 | Receipt upload | §5.4 | §12 storage | 6 | Private-serving test |
| BR-57 | Full payment completes the process | §5.4 | payment | 6 | **AC-17** |
| BR-28 | Manager records, Director views | §4 | payment | 6 | Permission test |
| — | Balance derived, not stored | §5.4 | §25 | 6 | **AC-16** |

## 6. Documents

| BR | Requirement | PRD | Architecture | Phase | Test |
|---|---|---|---|---|---|
| BR-07 | Blocked until BOX/WEIGHT exist | §9 | §11 readiness | 7 | **AC-04** exact message |
| BR-25 | Five document tabs | §9 | documents | 7 | Tab test |
| BR-26 | Formats preserved | §9 | §11 templates | 7 | **AC-18** |
| BR-36 | Printer integration replaceable/configurable | §6 | §13 PrinterAdapter | 7 | Adapter swap test |
| BR-62 | Sticker on Zebra ZD420, 12 × 8 cm | §9 | §13 adapter | 7 | **AC-19** |
| BR-63 | ADF does not print | §9 | §11 | 7 | **AC-20** no print path |
| BR-64 | AWB prints A4 | §9 | §11 | 7 | Output test |
| BR-65 | CDN prints A4 | §9 | §11 | 7 | Output test |
| BR-34 | NIC per document, not a system field | §9 | documents field_data | 7 | Field placement review |
| BR-33 | No Dangerous Goods workflow | §1 non-goals | — | — | Scope review |
| BR-35 | Single source of truth | §6 | §11, §25 | 7 | No-duplication review |
| — | Issued document immutable | §9 | §11 versioning | 7 | v2 creation test |

**Reference artifacts.** All five real documents are in `/references/documents/`: `ADF.jpg`,
`Air way bill.jpg`, `AWB_Stricker.jpg`, `CDN.jpg`, and
`SECURUTY CLEARANCE CERTIFICATE - HUB LANKA.doc (UDANA).doc`. Check the matching file before
implementing or changing a document's fields, layout, or terminology (BR-25, BR-26, BR-34, BR-62–BR-65).
The AWB is a carrier-issued (Qatar Airways) standard IATA form rather than a Hub Lanka template, so its
fidelity bar is IATA convention, not company design intent — see `/references/README.md` discrepancy §6.
Directly relevant to **OQ-2** (paper size) and **OQ-3** (manual field lists) below.

## 7. Analytics

| Requirement | PRD | Architecture | Phase | Test |
|---|---|---|---|---|
| Manager: weight by period, commodity, airline; financial; P/L | §10 | analytics | 9 | Reconciliation |
| Director: time, commodity, airline, shipper, financial | §10 | analytics | 9 | Reconciliation |
| Bar and pie charts with numbers | §10 | §17 | 9 | Component test |
| Figures reconcile with underlying records | §10 | §17 | 9 | Drill-through test |
| Profit uses stored historical rate | §8, §10 | §25 | 9 | **AC-14** |

## 8. Security and audit

| Requirement | PRD | Architecture | Phase | Test |
|---|---|---|---|---|
| Argon2id | §11 | §8 | 1 | Hash test |
| JWT + rotating refresh in httpOnly cookie | — | §8 | 1 | Refresh/revocation test |
| Permission-based RBAC, server-side | §4 | §9 | 1 | **AC-22** per endpoint |
| Guard fails closed on undeclared route | — | §9 | 1 | Undeclared-route test |
| Append-only audit | §11 | §10 | 1 | **AC-21** no update/delete path |
| Audit inside the transaction | §11 | §10, §14 | 1 | Rollback test |
| Files private, permission-checked | §7 | §12 | 6, 7 | Direct-URL attempt |
| Historical values never silently change | §11 | §25 | 3, 9 | **AC-14** |

**Phase 1 delivery note.** All six §8 rows above, plus BR-20 and BR-37 (§3), are delivered and
tested: Argon2id (`password-hasher.service.test.ts`), JWT + rotating refresh with reuse detection
(`auth.e2e-spec.ts`), server-side RBAC with **AC-22**-style permission-denied coverage on every
mutating identity/user endpoint (`permissions.e2e-spec.ts`), `PermissionsGuard`'s fail-closed
behaviour on an undeclared route (`permissions.guard.test.ts`), append-only audit enforced at the
database grant level with a real permission-denied assertion against the restricted role
(`audit-log-grants.e2e-spec.ts`, via Testcontainers), and audit-within-transaction atomicity proven
by a forced mid-transaction failure (`audit-atomicity.e2e-spec.ts`). BR-20 is satisfied by
construction — the seed (`apps/api/prisma/seed.ts`) creates exactly Executive/Manager/Director,
never a "Shift Leader" role. BR-37 is satisfied structurally (each `User` row is independent, and
`UserRole` lets any number of users hold the Manager role) but not exercised by a dedicated
four-distinct-managers test — noted here rather than silently claimed.

## 9. Coverage summary

| Area | Requirements | Phase-assigned | Test-assigned |
|---|---|---|---|
| Shipment identity and core | 11 | 11 | 11 |
| Lifecycle, status, deletion | 10 | 10 | 10 |
| Schedule, UI, operations | 12 | 12 | 12 |
| Financial | 21 | 21 | 21 |
| Payments | 6 | 6 | 6 |
| Documents | 12 | 11 (BR-33 is a non-goal) | 12 |
| Analytics | 5 | 5 | 5 |
| Security and audit | 8 | 8 | 8 |
| **Total** | **85** | **84 + 1 non-goal** | **85** |

**No confirmed requirement is unassigned to a phase and a test.**

Of the 85 rows, **65 are numbered business rules** (BR-01 to BR-67, less the void BR-31 and the merged
BR-29) and **20 are derived requirements** carried from PRD §5, §7, §8 and §11.

## 10. Open items — deliberately not in any phase as fixed behaviour

| OQ | Item | Affects phase | Handling |
|---|---|---|---|
| OQ-1 | Rate Table dimensions | 3 | Build confirmed shape; keep extensible |
| OQ-2 | Security Clearance paper size | 7 | Template built; size configurable |
| OQ-3 | Document manual field lists | 7 | `field_data` jsonb absorbs additions |
| OQ-4 | Buying-rate effective-date rule mid-booking | 3, 5 | Store applied rate value regardless |
| OQ-5 | FX rate for USD cost vs LKR expenses in reporting | 9 | Configurable |
| OQ-6 | Residual payment details | 6 | Build confirmed behaviour |
| OQ-7 | Director rights beyond create/view | 1, 2 | Permission rows; not assumed |
| OQ-8 | Executive visibility of invoices/payments/analytics | 1, 5, 6, 9 | Permission rows; not assumed |
| OQ-9 | Delete hard vs soft | 2 | **Soft delete + audit until answered** |
| OQ-10 | Cut-off readiness evaluation | 8 | Time-based only until confirmed |
| OQ-11 | Where actual departure is captured | 8 | Required by BR-50; field needed |
| OQ-12 | Chargeable Weight on Shipment or Invoice only | 5 | Required by BR-41 for buying cost |

## 11. Phase 10 — hardening & full system validation

Full audit performed against the live repository (all of Phases 0–9), not against this document's prior
claims. See the Phase 10 completion report for the full account; summarized here for traceability.

**Verified, not just re-asserted:** every table row above was checked against the actual current
implementation and its cited test was located and run (full suite: 99 API unit + 140 API e2e/Testcontainers-class
integration + 35 web tests, all green; typecheck/lint/format/build all green on `apps/api`, `apps/web`,
`packages/shared`). Migration-from-zero was verified against a genuinely fresh, isolated Postgres 17
container (not the shared dev database).

**One requirement found incorrectly complete, now fixed and re-verified:** BR-12/§2's shipment-update path
(`ShipmentService#update`) blocked editing only a `COMPLETED` shipment, not a `CANCELLED` one — a Cancelled
shipment's MAWB, flight, shipper/consignee, dates etc. could still be silently rewritten after cancellation,
contradicting "cancelled records are retained." Fixed (423 LockedError on both terminal statuses, matching
`CargoService`'s already-stricter posture) and covered by a new regression test
(`shipment.e2e-spec.ts`, "Cancelled locking").

**New hardening-only additions (no business rule changed):**
- Database `CHECK` constraints added for every positive-value field PRD §7 already specifies as validated
  (box count, weight, buying rate, invoice chargeable weight/exchange rate, invoice line amounts, cost
  sheet line amounts, payment amount) — ARCHITECTURE §5/CONTEXT §22 stated this as a requirement from
  Phase 2 onward but no migration had actually added one until now
  (`prisma/migrations/20260904190000_hardening_check_constraints`).
- `api`/`worker`/`web` Docker images now run as an unprivileged user instead of root.
- Five e2e spec files' `afterAll` cleanup gained a `cutoffAlert.deleteMany` before their `shipment.deleteMany`
  (`analytics`, `cargo`, `costsheet`, `invoice`, `payment`, `rates`, `shipment`, `documents` — 8 files total),
  matching `cutoff.e2e-spec.ts`'s already-correct ordering; without it, a real concurrently-running
  `CutoffCronService` raising an alert for a test's shipment made that file's cleanup fail on the `shipment` →
  `cutoff_alert` foreign key.

**Confirmed correct, no change needed:** RBAC fail-closed guard and per-route declarations (every mutating
endpoint), JWT algorithm confinement, refresh-token rotation/reuse-detection, session invalidation on
password/role/activation change, append-only audit at the database grant level, MAWB non-uniqueness,
Manager-own-non-Completed delete boundary, the AC-13 invoice reconciliation model (see below), the AC-15
Cost Sheet reconciliation (17,629.54), storage path-traversal defence, magic-byte upload validation,
idempotency-key handling on invoice issue/payment/document issue, optimistic-concurrency 409s.

**Known, previously-documented (not newly discovered) discrepancy — not silently forced:** the AC-13
reference invoice's real Security Charges line has an unreproducible ~1-cent LKR rounding gap against the
one physical specimen (`/references/README.md` discrepancy §2); the system computes **LKR 845,152.98**
against PRD §8's literal **845,152.99**. This was already flagged and accepted before Phase 10 — re-verified
here, not re-litigated.

**Environment-only issues (test flakiness, not code defects) diagnosed and resolved for this session:**
running the host-side e2e suite while a separate `docker compose` stack's `worker` container shares the same
Redis broker caused a document-render job-queue race (the docker worker's rendered PDF lands in its own
Docker-managed volume, invisible to the host-side test's disk reads) and, separately, resource contention
from two simultaneous Chromium instances caused one unrelated `beforeAll` timeout. Both disappeared on a
clean re-run; no application code was at fault. Documented under "Remaining risks" in the Phase 10 report —
most of this e2e suite runs against a persistent shared Postgres via `DATABASE_URL`/`APP_DATABASE_URL`, not
a fresh Testcontainers instance per file (only `audit-log-grants.e2e-spec.ts` does), which is why this class
of interference is possible at all.
