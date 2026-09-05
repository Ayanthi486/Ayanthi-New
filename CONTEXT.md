# CONTEXT.md — Hub Lanka Freight Forwarding Management System

**Permanent project context. Read this first, in every session, before doing anything else.**

This document is written for a developer or AI agent who has never seen the conversation in which these
requirements were gathered. It is the orientation document. It contains no code.

Status: pre-implementation. Repository is empty apart from documentation.

**`/references` contains the real Hub Lanka company source documents** — the actual Daily Shipment
Schedule, Cost Sheet, Invoice, and the five Phase 7 documents (Security Clearance, AWB Sticker, ADF, AWB,
CDN), as photographed/scanned originals or a blank company template. They are **read-only**: never modify,
rewrite, redraw, or rename them. Before implementing or changing any document- or calculation-related
feature, open the matching file there first — field names, order, terminology, layout and calculations in
code must match what's actually on these documents, not a generic assumption. See `/references/README.md`
for the full inventory and a list of discrepancies already found between these documents and the text
below.

---

## 1. Project identity

**Hub Lanka Freight Forwarding Management System (HLFFMS)** — an internal operations system for
**Hub Lanka (Pvt) Ltd**, an air freight forwarder in Sri Lanka.

- Registered office: 419 3/1, Galle Road, Colombo 03
- Airport operations: Terminal 3-1F-17, Air Cargo Village, Katunayake (BIA)
- IATA agent code: 0772418 · VAT Reg 1143035697000 · Business Reg PV 13221

This is a **real production system for real staff**, not a demo, prototype or coursework artefact.
Wrong numbers on an invoice cost the company money. Wrong data on a security declaration is a legal problem.

## 2. Business domain

Air freight forwarding. Hub Lanka does not own aircraft. It **buys cargo space from airlines** and
**resells it to shippers**, handling documentation, security clearance, customs and airport handling in between.

```
Shipper  ──▶  HUB LANKA  ──▶  Airline / Flight  ──▶  Consignee
             (freight forwarder)
```

Export from Colombo (CMB). Cargo is predominantly **perishable** — Edible Fish, Live Fish, Cut Foliage,
plus General Cargo. Perishability matters: a missed flight means spoiled cargo, so the cut-off warning
(§18) is a high-value feature, not a nicety.

Carriers seen in company records: Emirates (176), Qatar (157), Turkish (235), SriLankan (603),
Cathay (160), Singapore, FitsAir. Flights depart through the night — 02:55, 03:05, 06:50 are normal.

## 3. Business objective

Replace a manual process built on Excel sheets, paper files, email and phone with one system that holds
a single authoritative record per shipment, generates the company's existing documents from it, and
produces accurate financials.

## 4. System purpose

1. One central Shipment record, created once, reused everywhere.
2. Generate the company's five operational documents from that record without re-keying.
3. Calculate shipment profit correctly from selling revenue, airline buying cost and operational expenses.
4. Enforce who may do what, and record who did it.
5. Warn operations before cargo misses its flight.

## 5. Real-world operational context

- Roughly 10–25 staff. Volume in the tens of shipments per day.
- Night-shift operations; the airport team may be on a phone, not a desk.
- Users are Excel-fluent, not software-fluent. Keyboard-driven grids and export matter more than animation.
- Single tenant. One company. **Do not build multi-tenancy.**
- Connectivity and power in Sri Lanka are not guaranteed — degrade gracefully, provide print fallbacks.

## 6. User roles

Three roles. Four people hold the Manager role, each with an individual account.

| Role | Character |
|---|---|
| **Executive** | Operations. Creates shipments, handles cargo, prepares documents and the Cost Sheet. No approval or delete authority. |
| **Manager** | Commercial and approval authority. Buying rate, Invoice, payments, Cost Sheet approval, completion approval, cancellation approval, limited delete. |
| **Director** | Visibility and analytics. Can create shipments. No approvals, no delete. |

"Shift Leader" appears on the Cost Sheet. It is **not** a system role — it is an Executive responsibility.

## 7. Role responsibilities

**Executive** — create shipments · enter BOX and WEIGHT during cargo handling · edit while Pending ·
prepare/view/edit/print/download operational documents · prepare and **release** the Cost Sheet ·
request cancellation (cannot cancel) · copy MAWB · track · monitor cut-off warnings.

**Manager** — everything an Executive does, plus: enter the **airline buying rate** at booking ·
manage the **Rate Table** · manage **Handling Date** · **edit and approve** the Cost Sheet after release ·
create and manage the **Invoice** · set the **invoice exchange rate** · enter the invoice number ·
**record payments** and upload receipts · **approve completion** · **approve cancellation** ·
**delete only shipments they themselves created** · analytics.

**Director** — create shipments · view schedule and shipments · tracking · view invoices ·
view payment status and history · business analytics (time, commodity, airline, shipper, financial).

## 8. Core domain concepts

| Concept | Meaning |
|---|---|
| **Shipment** | The central record. One row = one complete shipment. Identified by Shipment ID. |
| **Shipment ID** | `HUB 000001`. System-generated, unique, database-enforced, never user-entered. |
| **MAWB** | Master Air Waybill, e.g. `176 2853 0191`. **Manually entered. NOT unique** — one MAWB may cover several shipments (consolidation). Used for external tracking. |
| **House AWB / HL No.** | e.g. `HL 0106`. Manually entered. Never auto-generated. |
| **Airline** | An explicit stored field on the Shipment. **Not** derived from the MAWB prefix. |
| **BOX** | The standard internal quantity term. Documents may display PCS/PACKAGES/Pkgs per their own format. |
| **Flight Date** | Used for flight and Invoice context. |
| **Handling Date** | Used for cargo handling and Cost Sheet context. **Never merge these two.** |
| **CUSDEC No** | Customs declaration number. Stored on the Shipment, hidden from the schedule grid, used to populate documents. |
| **Chargeable Weight** | Billing weight. Entered on the Invoice. Drives the airline buying cost. May differ from gross weight (a real example: gross 444.50 kg, chargeable 500.00 kg). |
| **Commodity** | Database-backed lookup. Executive and Manager may add new values. |
| **S/N No** | An existing Cost Sheet reference, manually maintained. Coexists with Shipment ID; does **not** replace it. |

## 9. Shipment lifecycle

```
[Executive | Manager | Director] ── Add Shipment ──▶ HUB nnnnnn generated
                                    Airline stored · Manager enters buying rate
                                                  │
                                          Status: PENDING
                                          BOX / WEIGHT may be null
                                                  │
              ┌───────────────────────────────────┴────────────────────┐
              │                                                        │
      CARGO HANDLING                                        CANCELLATION PATH
      Executive enters BOX + WEIGHT                         Executive requests + reason
              │                                                        │
      Documents unblock                                       Manager approves
              │                                                        │
  ┌───────────┼───────────┐                              Status: CANCELLED
  │           │           │                              (record retained)
DOCUMENTS  COST SHEET  INVOICE ──▶ PAYMENTS
           Exec        Manager     partial → fully paid
           releases        │
           Manager         │
           approves        │
              └────────┬───┘
                       │
           ALL CORRECTIONS FINISHED
                       │
              Manager approves
                       │
        Status: COMPLETED ▶ LOCKED · CANNOT BE DELETED
```

**Statuses are exactly three: Pending, Completed, Cancelled.** Do not invent more.

**Completed is final.** The workflow is not designed around reopening. Manager approval exists precisely
to confirm every correction is finished *before* finalisation.

**Four lifecycles run independently and must not be auto-merged:**
shipment operational status · airline booking confirmation · payment status · Cost Sheet approval state.
Full payment does **not** automatically make a shipment Completed.

## 10. Financial model

```
        CUSTOMER SELLING REVENUE  (Invoice — manually entered per shipment)
        Freight · MAWB Fee · Screening · Handling · Security
                        │
      ┌─────────────────┴─────────────────┐
      │                                   │
  FREIGHT LINE                    NON-FREIGHT LINES
  has an airline buying cost      NO airline cost — pure Hub Lanka revenue
      │
  AIRLINE BUYING COST = Chargeable Weight × Airline Buying Rate (USD)
      │
      └─────────────────┬─────────────────┘
                        │
              minus OPERATIONAL EXPENSES  (Cost Sheet, LKR, Handling Date context)
                        │
                        ▼
                SHIPMENT PROFIT
```

**Profit = customer selling revenue − airline buying cost − applicable operational expenses.**

There is **no** airline buying cost for MAWB Fee, Screening, Handling or Security. Do not create cost
lines mirroring those charges.

**Precision warning, from the company's real invoice.** The screening rate *displays* as `0.02` but
*computes* as `0.021`; the security charge computes as `36.2594`. **Stored precision must exceed displayed
precision** or totals will not reconcile against Hub Lanka's existing invoices — and profit inherits the error.
Money is `NUMERIC`/decimal. Never a float. Never a JavaScript `number`.

## 11. Buying rate model

- Provided by the airline, **weight-based**, quoted in **USD**.
- Applied to **Chargeable Weight**.
- **Changes weekly.**
- Maintained through a **Rate Table** with effective periods — not an arbitrary per-shipment field.
- The **Manager** enters/controls it during booking / shipment creation.

**Historical integrity requirement.** A new weekly rate must never alter a past shipment's profit.
*[Technical decision derived from BR-43, not a separate company rule]* The applied rate **value** is
stored on the shipment, not merely a reference to a rate-table row — a reference alone would let an edited
or superseded row silently rewrite history. BR-43 is the requirement; this is how it is satisfied.

Note the timing: the rate is captured at creation, but the cost is computed later, once Chargeable Weight
exists on the Invoice. Two distinct moments.

## 12. Cost Sheet workflow

Hub Lanka's **internal operational expenses**, in **LKR**, in **Handling Date** context.

Eleven fixed expense lines, all optional: SL Customs Receipts · SriLankan Security Charges Receipts ·
Animal Quarantine · Plant Quarantine · Transport · AASL Vehicle Pass · Labour ·
SriLankan Security Officer Expenses · Inspection · Operational · Other. Plus Total, Remarks,
Other Expenses, Shift Leader signature and Approved-by.

```
Executive prepares → RELEASES → Manager reviews → Manager edits if needed
    → Manager APPROVES → approval/signature recorded
```

Manager approval is a **workflow state with a recorded signature**, not a display-only field.

## 13. Invoice workflow

Manager-owned. **Flight Date** context. Dual currency LKR/USD with a per-invoice exchange rate.

Header: AWB Number · Flights · ETD Colombo · Dest · Commodity · Invoice No · Invoice Date · Shipper ·
Shipper Address · Consignee · Gross Wt · Chargeable Wt · No. of Pkgs · Currency · Term · AWB Ex-Rate.

Lines: Description · WT (Kgs) · Rate · Cur · Amount (USD) · Ex-Rate · Amount (LKR).

Charge lines seen in practice: Freight Charges, MAWB Fee, Screening Charges, Handling Charges,
Security Charges. **Values are entered per shipment — never hardcoded as fixed prices.**
Different lines use different weight bases (Freight on chargeable, Screening on gross, others flat).

- **Invoice Number is manually entered.** No auto-generation, no inferred sequence.
- **Exchange rate is set by the Manager.**
- Due date follows the credit term (a real example: 04 Aug + 5 days = 09 Aug).
- Chargeable Weight is used for billing; **airline weight breaks are handled manually**.
  Do not invent automatic rate calculation.

## 14. Payment workflow

```
Invoice issued (Manager)
   │
   ├─ partial payment(s): amount · date · receipt upload → remaining balance
   │
   └─ FULLY PAID ──▶ payment process COMPLETE
```

Partial payments supported · payment date stored · receipt/evidence uploaded ·
**full shipper payment marks the payment process complete** · Manager records · Director views.

Remaining balance is **derived** (invoice total − payments), never stored, so it cannot drift.

Payment completion and shipment completion are **separate concepts**.

## 15. Document workflow

Five tabs on the Shipment View, all keyed to Shipment ID. **Only two are Hub Lanka's own documents** —
the others belong to the ground handler, the port authority and the carrier. Hub Lanka fills them.
This is why format fidelity is not cosmetic: a moved field on a statutory form makes it unacceptable
to the officer reading it. Real examples of all five live in `/references/documents/` — read the
matching file before building or changing any of them.

| # | Document | Issuer | Actions | Output |
|---|---|---|---|---|
| 1 | **Security Clearance** | Hub Lanka | View · Edit · Print · Download | paper size OPEN |
| 2 | **AWB Sticker** | Carrier-branded | View · Edit · Print | Zebra ZD420, 12 × 8 cm |
| 3 | **ADF** (Acceptance Declaration Form, SriLankan Cargo, EXP-FO-016 Rev 05) | Ground handler | View · Edit / data handling | **NO PRINT** |
| 4 | **AWB** (Air Waybill) | Carrier | View · Edit · Print · Download | A4 |
| 5 | **CDN** (Cargo Despatch Note, SLPA, EXP 3b) | Port authority | View · Edit · Print · Download | A4 |

**Blocking rule:** documents requiring BOX and WEIGHT cannot be generated or printed until both exist.
Message: *"Cannot generate document. Please enter Box and Weight information."*

**Data flow:** the Shipment record populates the documents. Document-specific fields that do not exist
on the Shipment remain manually editable within the document. Never ask a user to re-type shipment data.

## 16. Printing requirements

- **AWB Sticker** → Zebra **ZD420**, cable connection, label **12 cm × 8 cm**.
- **AWB** and **CDN** → A4.
- **ADF** → no printing.
- **Security Clearance** → paper size not yet confirmed (OPEN).

Printer integration must sit behind a **replaceable adapter** so a future printer change does not touch
document or business logic.

## 17. Tracking workflow

The company already has a tracking system. **Do not build one.**

```
Shipment row → Copy MAWB → Track → https://hublanka.lk/tracking/ → NEW browser tab
```

Tracking is by MAWB. Copy MAWB shows a "MAWB copied" confirmation. Open with `noopener,noreferrer`.

## 18. Cut-off workflow

- Warning **starts 5 hours before flight departure**.
- Warning **ends at actual flight departure** — *not* when status becomes Completed.
- Conceptual states: Normal → Cut-off approaching → Urgent → Cut-off passed.
- Thresholds beyond the confirmed 5 hours are configurable, not hardcoded.
- BR-50 requires actual departure time to exist somewhere in the system, even though FLT ATD is
  excluded from the schedule grid (BR-23). **Where it is captured is OPEN — OQ-11.** Do not treat
  "on the Shipment record" as a settled decision; it is one candidate, not a confirmed requirement.

## 19. Audit requirements

- Every material change records actor, action, entity, before/after values, timestamp.
- Audit log is **append-only**. No update or delete path anywhere.
- Enforce at the database grant level: the application role holds INSERT and SELECT on the audit table only.
- Audit especially: rate changes, invoice changes, payment records, approvals, deletions, permission changes.
- **Historical financial data must never silently change.**

## 20. Security requirements

- Argon2id password hashing.
- JWT access token, short-lived; rotating refresh token in an httpOnly, Secure, SameSite cookie,
  hashed server-side so sessions are revocable. **Never store tokens in localStorage.**
- Permission-based RBAC, stored in the database, evaluated **server-side**. UI hiding is presentation only.
- Files private by default, served through authenticated permission-checked endpoints.
  Never a public bucket, never a guessable path.
- Parameterised queries only. Input validated at every boundary.

## 21. Important business rules

The full numbered list lives in **PRD.md**. The ones that most often get broken by accident:

1. Shipment ID is unique and database-enforced. MAWB is **not** unique. Never constrain MAWB.
2. BOX and WEIGHT are nullable at creation and entered later during cargo handling.
3. Documents are blocked until required BOX/WEIGHT exist.
4. Completed shipments are locked and cannot be deleted.
5. A Manager may delete **only shipments that same Manager created** — not another Manager's,
   not an Executive's, not a Director's. Executive and Director cannot delete at all.
6. Cancel ≠ Delete. Cancelled records are retained.
7. Cancellation requires a reason and Manager approval. Executives cannot cancel directly.
8. Only Freight carries an airline buying cost.
9. Buying cost uses **Chargeable Weight**, in USD, at the rate applicable to that shipment.
10. Flight Date and Handling Date are separate fields.
11. Invoice number is manual. Exchange rate is Manager-controlled.

## 22. Data integrity principles

- One central Shipment record. No duplicate storage of shipment data across documents.
- Money as `NUMERIC`; weights as decimal; timestamps as `timestamptz` in UTC, displayed `Asia/Colombo`.
- Foreign keys and CHECK constraints enforced **in the database**, not only in application code.
- Every state change writes entity + audit row in **one transaction**.
- Derived values (remaining balance, totals, profit) are computed, not stored — except where a
  historical snapshot is explicitly required (see §23).

## 23. Historical-data principles

Three things are deliberately snapshotted rather than recomputed:

1. **The applied airline buying rate**, stored on the shipment — weekly rate changes must not rewrite past profit.
2. **Issued document content**, stored with the rendered file — a printed document must render identically forever.
3. **Invoice line values at issue** — an invoice must not change because a lookup was later renamed or re-rated.

Everything else is derived. Never silently rewrite a historical financial value.

## 24. Technology stack

| Layer | Choice |
|---|---|
| Frontend | React 19 · **Vite** · TypeScript strict · Tailwind CSS v4 · shadcn/ui |
| Data/UI | TanStack Table v8 · TanStack Query v5 · Zustand · React Hook Form · Zod |
| Backend | NestJS 11 · Node.js 24 LTS · REST · OpenAPI/Swagger |
| Database | PostgreSQL 17 · Prisma 7 |
| Auth | Argon2id · JWT · rotating refresh tokens · permission-based RBAC |
| Storage | Cloudflare R2 |
| Documents | Puppeteer (HTML → PDF) · bwip-js where required |
| Testing | Vitest · Supertest · Testcontainers · Playwright |
| Repo | pnpm workspaces · Turborepo |
| Architecture | Modular monolith + separate worker process |

Do not replace any of this without identifying a real technical blocker.

## 25. Architecture principles

1. **Modular monolith.** One deployable API, internally bounded modules. Not microservices —
   issuing an invoice writes several tables atomically, and this scale does not justify distribution.
2. **One separate worker process** for scheduling, PDF rendering and the email outbox. A scheduler
   inside two API replicas fires every cut-off alert twice.
3. **All business logic lives in services.** Controllers parse and delegate. React components never
   contain business rules.
4. **Every state change is one transaction**: entity + audit row (+ events, + outbox rows) together, or none.
5. **Server-side authorization only.** Route guard, repository scoping, response field stripping.
6. **Adapters for anything external** — storage, printer, mail — so implementations are swappable.

## 26. Development methodology

Controlled vertical phases. Never one giant implementation. Each phase:

```
Read CONTEXT.md → PRD.md → ARCHITECTURE.md → DEVELOPMENT_PLAN.md
→ understand dependencies → implement ONLY the approved scope
→ add tests → validate → report exactly what changed → STOP
```

Never jump ahead into a later phase. See `docs/DEVELOPMENT_RULES.md`.

## 27. Testing principles

- **100 % coverage on money and weight calculation.** ≥80 % on services.
- Integration tests run against a **real PostgreSQL** (Testcontainers), not a mock — the whole point
  is constraint and transaction behaviour.
- Every mutating endpoint has a permission-denied test.
- Non-negotiable cases: profit arithmetic against the company's real invoice figures ·
  invoice issue atomicity under forced mid-transaction failure · delete permission boundaries ·
  cut-off firing exactly once including across a worker restart · historical rate preservation
  after a weekly rate change.

## 28. Things that must never be changed casually

1. The confirmed business rules in PRD.md. They came from the company, not from us.
2. The five document formats. They are statutory or carrier-controlled.
3. MAWB non-uniqueness.
4. The delete permission boundaries.
5. Historical financial values and the applied buying rate.
6. The audit log's append-only nature.
7. Server-side authorization.
8. The separation of Flight Date and Handling Date.
9. The three-status model.

If one of these appears to need changing, stop and raise it. Do not resolve it in code.

## 29. Known open / configurable items

Non-blocking. Tracked, not guessed. Full detail in PRD.md §12.

Twelve items, numbered OQ-1 to OQ-12 in PRD §12. Summarised here; **PRD §12 is authoritative**.

1. **OQ-1** Rate Table dimensions (airline, destination, weight break, effective-from/to).
2. **OQ-2** Security Clearance paper size and printer.
3. **OQ-3** Exact document-specific manual field lists.
4. **OQ-4** Buying-rate effective-date rule when the weekly rate changes mid-booking.
5. **OQ-5** Exchange rate used to resolve USD buying cost against LKR operational expenses in reporting.
6. **OQ-6** Residual payment workflow details.
7. **OQ-7** Director rights beyond create/view.
8. **OQ-8** Executive visibility of invoices, payments and analytics.
9. **OQ-9** Delete persistence — hard delete or soft delete.
10. **OQ-10** Whether the cut-off warning also evaluates BOX/WEIGHT/document readiness.
11. **OQ-11** Where actual flight departure time is captured (required by BR-50).
12. **OQ-12** Whether Chargeable Weight lives on the Shipment or only on the Invoice (required by BR-41).

## 30. Source-of-truth hierarchy

```
1. Confirmed business requirements provided by the company
   (/references — the real company source documents — is primary evidence for this level:
   document layout, field names/order/terminology and calculations, but not a substitute for a
   written business rule)
2. PRD.md
3. CONTEXT.md
4. docs/ARCHITECTURE.md
5. docs/DEVELOPMENT_PLAN.md
6. Approved phase-specific implementation instructions
7. Existing source code
```

If a lower level conflicts with a higher one: **do not silently choose.** Identify the conflict,
preserve the higher-level requirement, and update the lower-level document if appropriate. The same applies
when a `/references` document and a written rule disagree — flag it (see `/references/README.md`'s
"Discrepancies found" for examples already on record), don't silently resolve it in code.

**Never invent a business rule.** If something is unknown, mark it OPEN and continue with what is confirmed.
