# DEVELOPMENT_RULES.md — Hub Lanka Pvt Limited

**Operational guide for every implementation session.** Read with `CONTEXT.md` before writing any code.

---

## 1. Session protocol

```
1. Read CONTEXT.md · PRD.md · ARCHITECTURE.md · DEVELOPMENT_PLAN.md
2. Read the approved phase instruction
3. INSPECT the existing code in the modules you will touch — list what you read
4. State your plan and wait for approval if it touches >3 files or changes the schema
5. Implement ONLY the approved phase scope
6. Add tests
7. Run typecheck, lint, unit, integration
8. Report exactly what changed
9. STOP
```

**Never silently proceed into a later phase.** If a phase looks blocked, say so and stop.

## 2. Business rules

- **Never invent a business rule.** If it is not in PRD.md, it is not a rule.
- **Never silently change a confirmed requirement.** They came from the company, not from us.
- If a requirement seems wrong or contradictory, **stop and raise it**. Do not resolve it in code.
- If something is unknown, mark it OPEN in PRD §12 and continue with what is confirmed.
- A phase instruction that conflicts with PRD.md does not override it — flag the conflict.

## 3. Never break these

1. `shipment_no` unique and database-enforced; **`mawb_no` never unique** (BR-03).
2. BOX and WEIGHT nullable at creation (BR-05).
3. Documents blocked until required BOX/WEIGHT exist (BR-07).
4. Completed shipments locked and undeletable (BR-10, BR-49).
5. Delete: Manager only, own creations only, never Completed (BR-46 to BR-49).
6. Cancel ≠ Delete; cancelled records retained (BR-12).
7. Only Freight has an airline buying cost (BR-66).
8. Buying cost uses **Chargeable Weight** in USD (BR-41, BR-42).
9. Flight Date and Handling Date stay separate (BR-13).
10. The audit log is append-only.
11. Authorization is server-side.
12. Three statuses only (BR-08).

## 4. Security

- **Never bypass server-side authorization.** UI hiding is presentation, not access control.
- Every mutating route declares a permission. The guard **fails closed** on an undeclared route.
- Ownership rules (`shipment.delete.own`) are checked in the **service**, not only by permission string.
- **Never store tokens in `localStorage`.** Access token in memory, refresh token in an httpOnly cookie.
- Validate every input at the boundary with Zod. Parameterised queries only — no string concatenation
  in `$queryRaw`.
- Uploads: MIME + magic-byte validation, size cap, randomised keys, private storage, authenticated serving.
- Never log tokens, passwords or full financial payloads.
- Secrets in environment variables, validated at boot.

## 5. Data integrity

- **Never duplicate shipment source-of-truth data.** Documents reference the Shipment; they do not copy it.
  The only exceptions are the three deliberate snapshots (CONTEXT §23).
- **Never silently rewrite a historical financial value.** A weekly rate change must not move last week's profit.
- **Never hard-delete a legally or financially significant record** unless explicitly permitted.
  A shipment with an issued invoice, a recorded payment or a signed Security Clearance qualifies.
  While OQ-9 is open, implement delete as **soft delete with an audit entry** and surface the question.
- Use a database transaction for every critical workflow (ARCHITECTURE §14).
- Money is `NUMERIC`/decimal end to end. **Never a float. Never a JavaScript `number`.**
  Stored precision exceeds displayed precision.
- Timestamps `timestamptz` in UTC; display `Asia/Colombo`.
- Derived values are computed, not stored — remaining balance, totals, profit.

## 6. Code structure

- **Business logic lives in services.** Controllers parse and delegate. A controller containing an `if`
  about business state is a defect.
- **No business logic in React components.** No business rules in a `useEffect`.
- Modules talk through public service interfaces, never another module's repository.
- **Keep document templates isolated** — they receive a prepared view model and contain no business logic.
- **Keep printer integration isolated** behind `PrinterAdapter`. Nothing above it references a printer.
- Shared Zod schemas, enums and permission constants live in `packages/shared` and are defined once.
- Check for an existing helper or shared component before creating one.

## 7. Restraint

- **Do not create unnecessary abstractions.** Two implementations justify an interface; one does not —
  except where ARCHITECTURE explicitly requires an adapter.
- **Do not introduce unnecessary dependencies.** Justify any new package in the phase report.
- Do not add features outside the approved phase scope, however small they seem.
- Do not refactor code outside the phase scope. Unscoped refactors are the main source of regression.
- Do not build multi-tenancy, a tracking system, a DG workflow, or a general NIC feature. All out of scope.

## 8. Testing

- Tests ship **in the same phase** as the feature. Tests deferred are tests never written.
- **100 % coverage on money and weight calculation.** ≥80 % on services.
- Every mutating endpoint has a **permission-denied** test.
- Test business rules explicitly: locking, delete boundaries, cancellation approval, document blocking.
- Test financial calculations against the company's real reference figures (PRD §8).
- Test document outputs — population correctness and blocked-state behaviour.
- Integration tests run against a **real PostgreSQL** via Testcontainers, never a mock. The point is
  constraint and transaction behaviour, which a mock cannot exercise.
- Regression guard: a test asserting two shipments may share one MAWB, so nobody "fixes" BR-03.

## 9. Migrations

- Versioned, committed, and **read before merge** — Prisma will happily generate a table rewrite.
- **Additive within a release**: add column → backfill → switch → drop in a later release.
- Split multi-step changes by hand (add nullable → backfill → set not-null).
- Never edit a migration after it has been applied.

## 10. Decisions

Record any material architectural decision — what was chosen, why, what was rejected, what it costs.
Future sessions apply the written decision, not the reasoning that produced it, so write the reasoning down.

Anything that changes a business rule does **not** go in a decision record; it goes back to the company.

## 11. Phase discipline

- One phase per session. **Never implement multiple phases in one uncontrolled operation.**
- After each phase: report exactly what changed — files, endpoints, tables, tests — and **stop**.
- Do not begin the next phase without an explicit phase-specific instruction.
- If you finish early, do not start the next phase. Report and stop.

## 12. Reporting format

```
PHASE <n> — <name>
Files created / modified
Database changes (tables, columns, migrations)
Endpoints added
Tests added and results
Acceptance criteria met (reference AC-nn)
Deviations from the plan, with reasons
Open questions encountered
Anything NOT done that was in scope
```

Report honestly. An unfinished item stated plainly is far cheaper than one discovered in Phase 10.
