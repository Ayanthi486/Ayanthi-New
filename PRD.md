# PRD.md — Hub Lanka Freight Forwarding Management System

**Product source of truth. Describes WHAT the system must do.**

Every requirement here traces to a confirmed company answer. Nothing is invented. Where something is
unknown it appears in §12 as OPEN, never as a guess.

Read alongside `CONTEXT.md` (orientation) and `docs/ARCHITECTURE.md` (how).

**`/references` holds the real Hub Lanka source documents** this PRD's document and calculation
requirements describe (Daily Shipment Schedule, Cost Sheet, Invoice, and the five Phase 7 documents) —
read-only, never modified. Where a confirmed requirement below and one of those documents diverge, the
divergence is recorded in `/references/README.md` rather than silently resolved either way.

---

## 1. Scope

### In scope

| Area | Content |
|---|---|
| Shipment management | Create, edit, cancel, delete (restricted), complete; Daily Shipment Schedule |
| Cargo handling | BOX and WEIGHT capture during handling |
| Master data | Shippers, consignees, airlines, commodities, destinations, users, roles |
| Rate Table | Weekly airline buying rates with effective periods |
| Cost Sheet | Internal operational expenses with a release → review → approve workflow |
| Invoice | Customer selling charges, dual currency, manual number and exchange rate |
| Payments | Partial payments, dates, receipt upload, fully-paid state |
| Documents | Security Clearance, AWB Sticker, ADF, AWB, CDN |
| Printing | Zebra ZD420 sticker; A4 for AWB and CDN |
| Cut-off | 5-hour pre-departure warning ending at actual departure |
| Tracking | Link-out to the company's existing tracking system |
| Analytics | Manager and Director reporting |
| Security | Authentication, permission-based RBAC, audit trail |

### Non-goals

- Building a tracking system — the company already has one.
- Airline reservation writes — the system does not book into carrier systems.
- Replacing customs software.
- Dangerous Goods workflow — explicitly not required.
- A general NIC storage/user-identity feature — NIC is handled per document where the format requires it.
- Multi-tenancy — single company.
- Native mobile applications.
- Airline cost lines for MAWB Fee, Screening, Handling or Security — these carry no buying cost.

## 2. Goals

1. One authoritative Shipment record; no duplicate entry across documents.
2. Financially accurate profit per shipment, preserved against future rate changes.
3. Faithful reproduction of the company's existing document formats.
4. Enforced role boundaries with a complete audit trail.
5. Operational warning before cargo misses its flight.

## 3. Users and roles

Three roles. **Four people hold the Manager role**, each with an individual account.

| Role | Primary function |
|---|---|
| Executive | Operations, cargo handling, operational documents, Cost Sheet preparation |
| Manager | Commercial authority, approvals, finance, restricted delete |
| Director | Visibility, analytics, financial oversight; may create shipments |

Shift Leader is an Executive responsibility, **not** a system role.

## 4. Permissions

✔ permitted · **O** own records only · **R** read-only · **A** approval authority · ✖ denied · **?** OPEN

| Action | Executive | Manager | Director |
|---|---|---|---|
| Create shipment | ✔ | ✔ | ✔ |
| Edit shipment (Pending) | ✔ | ✔ | **?** |
| Edit shipment (Completed) | ✖ | ✖ | ✖ |
| Delete shipment | ✖ | **O** own creations, not Completed | ✖ |
| Request cancellation | ✔ | ✔ | **?** |
| Approve cancellation | ✖ | **A** | ✖ |
| Approve completion | ✖ | **A** | ✖ |
| Enter BOX / WEIGHT | ✔ | ✔ | ✖ |
| Enter airline buying rate | ✖ | ✔ | ✖ |
| Manage Rate Table | ✖ | ✔ | **?** |
| Manage Handling Date | ✖ | ✔ | ✖ |
| Prepare / release Cost Sheet | ✔ | ✔ | ✖ |
| Edit Cost Sheet after release | ✖ | ✔ | ✖ |
| Approve Cost Sheet | ✖ | **A** | ✖ |
| Create / edit Invoice | ✖ | ✔ | ✖ |
| Set invoice exchange rate | ✖ | ✔ | ✖ |
| Enter invoice number | ✖ | ✔ | ✖ |
| Record payment / upload receipt | ✖ | ✔ | ✖ |
| View invoices | **?** | ✔ | **R** |
| View payment status / history | **?** | ✔ | **R** |
| Documents: view / edit / print / download | ✔ | ✔ | **R** |
| Add commodity | ✔ | ✔ | **?** |
| Copy MAWB · Track · View schedule | ✔ | ✔ | ✔ |
| Analytics | **?** | ✔ | ✔ |

Cells marked **?** are listed in §12. They are not assumed either way.

## 5. Workflows

### 5.1 Shipment lifecycle

```
Create (Executive | Manager | Director)
   → Shipment ID generated · Airline stored · Manager enters buying rate
   → PENDING (BOX/WEIGHT may be null)
      ├─ Cargo handling: Executive enters BOX + WEIGHT → documents unblock
      ├─ Cost Sheet: Executive releases → Manager reviews/edits → Manager approves
      ├─ Invoice: Manager creates → Payments recorded → fully paid
      └─ Cancellation: Executive requests + reason → Manager approves → CANCELLED (retained)
   → All corrections finished → Manager approves → COMPLETED (locked, undeletable)
```

Statuses: **Pending · Completed · Cancelled**. No others.

Four independent lifecycles that must not be auto-merged: shipment status · airline booking confirmation ·
payment status · Cost Sheet approval state.

### 5.2 Daily Shipment Schedule

Default view **today + tomorrow**, sorted by **DEP TIME**. One row = one complete shipment.

Columns: `[View]` · Shipment ID · DEP TIME · MAWB NO · DEST · FLIGHT · DATE · SHIPPER · CONSIGNEE ·
COMMODITY · BOX · WEIGHT · STATUS · Actions.

**Excluded columns:** CUS NO · FLT ATD · BOOKED BOX · BOOKED WEIGHT.

Row actions: **View** (leftmost, a row action not a data column) · Edit · Copy MAWB · Track.

Search by Shipment ID. Filter by date.

### 5.3 Cost Sheet approval

```
Executive prepares, signs, RELEASES → Manager reviews → Executive or Manager
edits while Released → Manager APPROVES → approval/signature recorded
→ once Approved, only Manager may still edit (Executive locked out)
```

### 5.4 Payment

```
Invoice issued → partial payment(s) [amount · date · receipt] → remaining balance
→ FULLY PAID = payment process complete
```

### 5.5 Cut-off warning

Starts **5 hours before flight departure**. Ends at **actual flight departure** — not at Completed status.
States: Normal → Cut-off approaching → Urgent → Cut-off passed.

## 6. Business rules

Authoritative numbered list. BR-31 is void (superseded).

### Identity and shipment core

| # | Rule |
|---|---|
| BR-01 | Executive, Manager and Director can all create shipments |
| BR-02 | Shipment ID auto-generated as `HUB 000001`, unique, enforced at database level, never user-entered |
| BR-03 | MAWB is manually entered and **not unique** — one MAWB may cover multiple shipments |
| BR-04 | House AWB is manually entered; never auto-generated; no uniqueness rule defined |
| BR-05 | A shipment may be saved without BOX and WEIGHT |
| BR-06 | Executive enters BOX and WEIGHT during cargo handling; editable until finalised |
| BR-13 | Flight Date and Handling Date are separate fields and must not be merged |
| BR-18 | BOX is the standard internal quantity term; documents may display their own terminology |
| BR-19 | CUSDEC No is stored on the shipment, hidden from the schedule grid, used to populate documents |
| BR-51 | Shipment ID and Cost Sheet S/N No both exist as separate identifiers |
| BR-58 | Airline is a stored Shipment field — not derived from the MAWB prefix |

### Lifecycle, status and deletion

| # | Rule |
|---|---|
| BR-08 | Statuses are exactly Pending, Completed, Cancelled |
| BR-09 | Completed requires Manager approval |
| BR-10 | A Completed shipment is locked against normal editing |
| BR-11 | Executive cannot cancel directly; cancellation requires a reason and Manager approval |
| BR-12 | Cancel retains the record with status Cancelled; Delete is a separate concept |
| BR-46 | A Manager cannot delete another Manager's shipment |
| BR-47 | A Manager cannot delete an Executive- or Director-created shipment |
| BR-48 | Executive and Director have no delete permission |
| BR-49 | Completed shipments cannot be deleted |
| BR-67 | Shipment status, airline booking confirmation, payment status and Completed status are distinct and must not be auto-merged |

### Schedule, UI and operations

| # | Rule |
|---|---|
| BR-15 | Dashboard defaults to Today + Tomorrow, sorted by DEP TIME |
| BR-16 | DEP TIME uses a 24-hour picker; no AM/PM. DATE uses a calendar picker |
| BR-17 | Commodity is database-backed; Executive and Manager may add new commodities |
| BR-21 | Cut-off warning starts 5 hours before flight departure |
| BR-50 | Cut-off warning ends at **actual flight departure** |
| BR-22 | Tracking opens `https://hublanka.lk/tracking/` in a new tab, based on MAWB; Copy MAWB provided |
| BR-23 | Schedule excludes CUS NO, FLT ATD, BOOKED BOX, BOOKED WEIGHT |
| BR-24 | View is a row action at the left, not a data column |
| BR-20 | Shift Leader is an Executive responsibility, not a system role |
| BR-37 | Four Managers, individual accounts, same interface |

### Financial

*Numbering note: BR-29 ("invoice charge values are entered per shipment, not fixed") is subsumed by BR-40 and is not restated. BR-31 is void.*

| # | Rule |
|---|---|
| BR-38 | Profit = customer selling revenue − airline buying cost − applicable operational expenses |
| BR-39 | Airline buying rate is weight-based |
| BR-40 | Customer selling charges are manually entered per shipment |
| BR-41 | Airline buying cost uses **Chargeable Weight** |
| BR-42 | Airline buying rate is in **USD** |
| BR-43 | Airline buying rate changes **weekly**; historical effective rates must be preserved |
| BR-44 | Manager enters/controls the buying rate during booking / shipment creation |
| BR-45 | Buying rates are maintained through a **Rate Table** |
| BR-66 | No airline buying cost for MAWB Fee, Screening, Handling or Security |
| BR-32 | Cost Sheet holds Hub Lanka's internal operational expenses only |
| BR-14 | Cost Sheet uses Handling Date context |
| BR-52 | Invoice Number is manually entered — no auto-generation |
| BR-53 | Invoice Exchange Rate is controlled by the Manager |
| BR-59 | Executive releases the Cost Sheet for Manager review |
| BR-60 | Executive or Manager can edit the Cost Sheet after release when corrections are required |
| BR-61 | Manager approves the Cost Sheet; approval/signature is recorded |
| BR-68 | Once Approved, only Manager may still edit the Cost Sheet — Executive loses edit access |
| BR-27 | Managers create invoices; Director views them |
| BR-30 | Chargeable Weight is used for billing; weight breaks handled manually; no automatic rate calculation |
| BR-31 | ~~Airline carrier cost is out of scope~~ — **VOID, superseded by BR-38/BR-45** |

### Payments

| # | Rule |
|---|---|
| BR-54 | Partial payments are supported |
| BR-55 | Payment date is stored |
| BR-56 | Payment receipt/evidence can be uploaded |
| BR-57 | Full shipper payment marks the payment process complete |
| BR-28 | Manager records payment; Director views status and history |

### Documents

| # | Rule |
|---|---|
| BR-07 | Documents requiring BOX/WEIGHT are blocked until both exist |
| BR-25 | Five document tabs: Security Clearance, AWB Sticker, ADF, AWB, CDN |
| BR-26 | Existing company document formats are preserved; surrounding UI may be modernised |
| BR-36 | Printer integration must remain replaceable/configurable so a printer change does not require rewriting document or business logic |
| BR-62 | AWB Sticker prints on Zebra ZD420 via cable, 12 cm × 8 cm |
| BR-63 | ADF does **not** require printing |
| BR-64 | AWB prints on A4 |
| BR-65 | CDN prints on A4 |
| BR-34 | NIC is not a general system field; handled per document where the format requires it |
| BR-33 | Dangerous Goods workflow is not required |
| BR-35 | Single source of truth — no duplicate storage of shipment data across documents |

## 7. Validation rules

| Field | Rule |
|---|---|
| Shipment ID | System-generated, unique, immutable, never accepted from the client |
| MAWB | Format `nnn nnnn nnnn`; **no unique constraint**. Modulus-7 check-digit validation is *[INFERRED]* from the company's document samples, not a company-stated rule — make it configurable and non-blocking until confirmed |
| House AWB | Free text, optional |
| DEP TIME | 24-hour, required |
| Flight Date / Handling Date | Valid dates, separate fields |
| BOX | Positive integer, nullable until cargo handling |
| WEIGHT | Positive decimal, nullable until cargo handling |
| Commodity, Airline, Shipper, Consignee | Must reference an active master record |
| Cancellation reason | Mandatory on a cancellation request |
| Money | Decimal, never float; stored precision exceeds displayed precision |
| Buying rate | Positive decimal, USD |
| Chargeable weight | Positive decimal; may exceed gross weight |
| Payment amount | Positive. *[INFERRED]* Cumulative payments may not exceed the invoice total — not company-stated; see OQ-6 |
| Uploads | MIME + magic-byte validation, size cap |

## 8. Financial rules

**Airline buying cost = Chargeable Weight × applicable Airline Buying Rate (USD).**
Freight only. No buying cost for MAWB Fee, Screening, Handling or Security.

**Profit = customer selling revenue − airline buying cost − applicable operational expenses.**

**Historical integrity.** The rate value applied to a shipment is stored on that shipment. A later
weekly rate change must not alter a past shipment's profit. Verified by test.

**Precision.** Derived from the company's real invoice: the screening rate displays as `0.02` but computes
as `0.021`; security computes as `36.2594`. Stored precision must exceed displayed precision. Totals must
reconcile exactly against the company's existing invoices.

**Reference reconciliation** (real company invoice, used as a test fixture):
Freight 500.00 × 4.75 = 2,375.00 · MAWB Fee 26.50 · Screening 444.50 × 0.021 = 9.33 ·
Handling 35.00 · Security 36.26 → **Total USD 2,482.09** · at 340.50 → **Total LKR 845,152.99**.

The source invoice is `/references/company-process/invoice.pdf`. Reading it resolved the rounding model
this prose alone left ambiguous: **each line's USD amount is `round2(rate × weight)`, and that same line's
LKR amount is `round2(rate × weight × exchange rate)`, computed from the same full-precision base — not
`round2(USD amount) × exchange rate`.** The two differ measurably: Screening's true base is
444.50 × 0.021 = 9.3345 — the invoice prints USD `9.33` (`round2(9.3345)`) but LKR `3,178.40`, which only
comes from `round2(9.3345 × 340.50)`; `9.33 × 340.50` rounds to `3,176.87`, not `3,178.40`. Totals are the
sum of the (independently rounded) per-line amounts, not a round-of-sum. Four of the five real lines
(Freight, MAWB Fee, Screening, Handling) reconcile exactly under this model; Security has a small (~1 cent)
unresolved gap against the one real specimen invoice, flagged rather than forced — see
`/references/README.md`'s "Discrepancies found" §1/§2 for the full derivation.

**Weight bases differ per line** — Freight on chargeable, Screening on gross, others flat.

## 9. Document requirements

The real originals for all five documents below are in `/references/documents/` (read-only) — check the
matching file before implementing or changing a document's fields, layout, or terminology; the AWB is a
carrier-issued (Qatar Airways) standard IATA form rather than a Hub Lanka template, so its fidelity bar is
set by IATA convention, not by company design intent.

| Document | Populated from Shipment | Manual fields | Output |
|---|---|---|---|
| Security Clearance | AWB, cargo description, BOX/WEIGHT, flight, date, destination, shipper | Name, designation, NIC, handover and taken-charge blocks | Print · Download (size OPEN) |
| AWB Sticker | AWB, origin, destination, BOX | Carrier template selection | Zebra ZD420, 12 × 8 cm |
| ADF | Flight, date, AWB, routing, CUSDEC, shipper, BOX/WEIGHT | Dimensions table, CBM, ULD/BT number, acceptance pallet no., tel, NIC, office-use times | **No print** |
| AWB | Shipper, consignee, routing, flight, weights, commodity, charges | IATA code, SHC codes, HS commodity codes, temperature instructions, carrier charge codes, AWB exchange rate | Print · Download, A4 |
| CDN | Shipper + address, consignee + address, flight, destination, MAWB, BOX, weight, commodity, CUSDEC | Lorry/trailer no., tare wt, SLP no., agent seal no., driver, cleaner, net wt, cube m³, declarant, tel | Print · Download, A4 |

Official-use sections on the CDN print blank. Formats are reproduced faithfully — several are statutory
or carrier-controlled and cannot be redesigned.

## 10. Analytics requirements

**Manager:** daily/weekly/monthly/yearly weight · commodity-wise weight · airline-wise analysis ·
financial values · expenses · profit/loss. Bar and pie charts, with numbers alongside.

**Director:** by time (daily/weekly/monthly/yearly) · by commodity · by airline · by shipper
(shipment weight per period) · financial (sales/invoice values, expenses, loss, profit).
Numbers plus bar and pie charts.

Every figure must reconcile exactly with the underlying records for the same filters.

## 11. Audit requirements

- Actor, action, entity, entity id, before/after values, timestamp, IP on every material change.
- Append-only. No update or delete path. Enforced at the database grant level.
- Always audited: shipment create/edit/delete/cancel · status transitions · buying rate entry and change ·
  Rate Table changes · Cost Sheet release, edit and approval · invoice create/edit · exchange rate changes ·
  payment records · document issue/print · permission changes.
- Historical financial values must never silently change.

## 12. Open / configurable items

Tracked, not guessed. None blocks the overall design.

| # | Item |
|---|---|
| OQ-1 | Rate Table dimensions — airline, destination, weight break, effective-from/to, any others |
| OQ-2 | Security Clearance paper size and printer |
| OQ-3 | Exact document-specific manual field lists |
| OQ-4 | Buying-rate effective-date rule when the weekly rate changes mid-booking |
| OQ-5 | Exchange rate used to resolve USD buying cost against LKR operational expenses for profit reporting |
| OQ-6 | Residual payment workflow details |
| OQ-7 | Director rights beyond create/view — edit, cancellation request, commodity add, Rate Table |
| OQ-8 | Executive visibility of invoices, payments and analytics |
| OQ-9 | Delete persistence — hard delete or soft delete (see ARCHITECTURE §14 for the tension with audit) |
| OQ-10 | Whether the cut-off warning also evaluates BOX/WEIGHT/document readiness |
| OQ-11 | Where actual flight departure time is captured, given FLT ATD is excluded from the grid but BR-50 requires it |
| OQ-12 | Whether Chargeable Weight lives on the Shipment or only on the Invoice, given BR-41 needs it for buying cost |

## 13. Acceptance criteria

| # | Criterion |
|---|---|
| AC-01 | Concurrent shipment creation never produces a duplicate Shipment ID |
| AC-02 | Two shipments may share one MAWB |
| AC-03 | A shipment saves successfully with BOX and WEIGHT empty |
| AC-04 | Document generation is blocked with the exact confirmed message until BOX and WEIGHT exist |
| AC-05 | Schedule opens on today + tomorrow, sorted by DEP TIME |
| AC-06 | Search by Shipment ID and filter by date both return correct results |
| AC-07 | Copy MAWB copies to clipboard and confirms |
| AC-08 | Track opens the company tracking URL in a new tab |
| AC-09 | Cut-off warning appears 5 hours before departure and clears at actual departure |
| AC-10 | An Executive cannot cancel directly; a cancellation without a reason is rejected |
| AC-11 | A Manager cannot delete another Manager's, an Executive's or a Director's shipment |
| AC-12 | A Completed shipment cannot be edited or deleted |
| AC-13 | Profit reproduces the reference invoice figures exactly (§8) |
| AC-14 | Changing this week's buying rate does not alter last week's shipment profit |
| AC-15 | Cost Sheet cannot be approved before it is released; approval records a signature |
| AC-16 | Partial payments accumulate correctly and the remaining balance is accurate |
| AC-17 | Full payment marks the payment process complete without changing shipment status |
| AC-18 | Each generated document matches the company's format and populates from the Shipment |
| AC-19 | The AWB Sticker renders at 12 × 8 cm for the Zebra ZD420 |
| AC-20 | The ADF exposes no print action |
| AC-21 | Every material change produces an audit entry; no API can update or delete one |
| AC-22 | Every mutating endpoint rejects an unauthorised role server-side, verified by test |
