# /references — Read-only company source artifacts

**These are real Hub Lanka (Pvt) Ltd documents, not application data and not samples authored for this
project.** They are the ground truth for document fidelity, calculation validation, and field/layout
naming. See `DEVELOPMENT_RULES.md` §2 ("Never invent a business rule") and `CONTEXT.md`/`PRD.md`'s
source-of-truth hierarchy — this directory sits alongside those documents as primary evidence.

**Rules for this directory, non-negotiable:**

1. Files here are **never modified, rewritten, redrawn, converted, or renamed**. Treat every file as
   read-only. If a file must be viewed in a format this toolchain can't read directly (e.g. the legacy
   `.doc`), extract text to a _separate, outside-the-repo_ scratch location for reading — never overwrite
   or resave the original.
2. **Before implementing or changing any of the five Phase 7 documents, the Cost Sheet, or the Invoice,
   re-open the matching file here first.** Field names, field order, terminology, layout, and calculations
   in code must match what's in these files, not a generic freight-forwarding assumption.
3. When a reference file and `PRD.md`/`CONTEXT.md` disagree, **do not silently pick one** — flag the
   conflict and preserve the documented business-requirement hierarchy (confirmed requirements → `PRD.md`
   → `CONTEXT.md` → `ARCHITECTURE.md` → `DEVELOPMENT_PLAN.md` → source code). See "Discrepancies found"
   below for what's already been identified.
4. Do not invent fields that aren't in either the reference file or a confirmed requirement, even if
   they're common in freight-forwarding software generally.

## Directory structure

- **`company-process/`** — the core operational/financial workflow forms this system replaces or
  reproduces phase-by-phase (Daily Shipment Schedule → Phase 2, Cost Sheet → Phase 4, Invoice → Phase 5).
- **`documents/`** — the five statutory/carrier/company documents from `DEVELOPMENT_PLAN.md` Phase 7
  ("Documents, PDF generation and printing"): Security Clearance, AWB Sticker, ADF, AWB, CDN.

## Inventory

### `company-process/shedule.jpg`

|                                  |                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document type                    | Daily Shipment Schedule (legacy, as run on paper/Excel before this system)                                                                        |
| Source/purpose                   | A real printed page from Hub Lanka's existing handling/booking sheet — photographed, not a designed sample                                        |
| Example or standard form         | Real operational instance (two live sections: "10 & 11.04.2026 HANDLING SHIPMENTS" and "10 & 11.04.2026 BOOKING SHIPMENTS"), not a blank template |
| PRD/architecture feature         | Phase 2 — Shipment Core; PRD §5.2 Daily Shipment Schedule; BR-15, BR-16, BR-23, BR-24                                                             |
| Used for UI layout               | Yes — confirms the schedule grid's real-world column set                                                                                          |
| Used for calculation validation  | No                                                                                                                                                |
| Used for PDF/document generation | No — this is an internal operational grid, not an issued document                                                                                 |

**Notes:** This sheet still carries CUS NO, FLT ATD, BOOKED BOX and BOOKED WEIGHT columns — exactly the
four columns BR-23 says the new system must _exclude_. Seeing them here (present but unused/blank in the
legacy sheet) confirms BR-23 is a deliberate simplification of a messy legacy layout, not an oversight.
The legacy sheet has no Shipment ID column, since `HUB nnnnnn` (BR-02) is a new concept this system
introduces — expected, not a discrepancy.

### `company-process/cost_sheet.jpeg`

|                                  |                                                                                                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document type                    | Shipment Cost Sheet (Hub Lanka's own form)                                                                                                                       |
| Source/purpose                   | A real filled/signed cost sheet, photographed                                                                                                                    |
| Example or standard form         | Real filled instance of the standard company form (handwritten amounts, real shift-leader and approver signatures)                                               |
| PRD/architecture feature         | Phase 4 — Cost Sheet; PRD §5.3, CONTEXT.md §12; BR-32, BR-51, BR-59/60/61                                                                                        |
| Used for UI layout               | Yes — header fields and the 11 expense-line labels/order                                                                                                         |
| Used for calculation validation  | Yes — its Total (17,629.54) is the exact figure `DEVELOPMENT_PLAN.md`'s Phase 4 test line uses, and it reconciles cleanly by plain summation of the filled lines |
| Used for PDF/document generation | Not yet built (no Cost Sheet PDF output exists in the plan), but this is the layout reference if one is added later                                              |

**Header fields on the real form:** S/N No, MAWB No, Flight No & Date, Shipper Name, Consignee Name,
Commodity, Boxes, Weight, Cusdec No, **Shift Leader Name** (a distinct field, separate from the
signature line at the bottom).

**Line labels on the real form, in order** (fuller wording than `CONTEXT.md` §12's terse list):
SL Customs Receipts · Sri Lankan Security Charges Receipts · Animal Quarantine Charges Receipts ·
Plant Quarantine Charges Receipts · Transport Charges · AASL Vehicle Pass · Labour Charges ·
Sri Lankan Security Officer Expenses · Inspection Expenses · Operational Expenses · Other Expenses ·
Total. Then a Remarks / Other Expenses box, and two signature lines: "Shift leader Signature :-" and
"Approved by :-".

### `company-process/invoice.pdf`

|                                  |                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Document type                    | Freight Invoice (Hub Lanka's own form)                                                                                    |
| Source/purpose                   | A real issued invoice (AWB 157 0659 8944, Invoice No HUB/IU/0676/2026)                                                    |
| Example or standard form         | Real issued instance, not a blank template                                                                                |
| PRD/architecture feature         | Phase 5 — Invoice; CONTEXT.md §13; PRD §8 (the AC-13 reference figures), BR-40/41/42/52/53/66                             |
| Used for UI layout               | Yes — header field set/order and the line-item table columns                                                              |
| Used for calculation validation  | **Yes, directly** — this is the literal source of AC-13's USD 2,482.09 / LKR 845,152.99 figures                           |
| Used for PDF/document generation | Yes — this is the target layout for Phase 5's invoice output, including the bank-transfer and payment-terms footer blocks |

**This is the single most calculation-critical file in this directory.** See "Discrepancies found" below —
reading the real per-line figures resolved an arithmetic ambiguity in `PRD.md`'s prose description that
this session had otherwise flagged as blocking.

### `documents/ADF.jpg`

|                                  |                                                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Document type                    | Acceptance Declaration Form (ground handler's form, EXP-FO-016 Rev 05)                                           |
| Source/purpose                   | A real filled ADF, photographed                                                                                  |
| Example or standard form         | Real filled instance                                                                                             |
| PRD/architecture feature         | Phase 7 — Documents; PRD §9 ADF row; BR-63 (no print path); OQ-3                                                 |
| Used for UI layout               | Yes — and it's the authoritative source for OQ-3's ADF manual-field list, which PRD only summarizes              |
| Used for calculation validation  | No                                                                                                               |
| Used for PDF/document generation | On-screen render only per BR-63 — no print/PDF path, but still the field-layout reference for the on-screen form |

**Notes:** Richer than PRD §9's summary suggests — distinguishes Loose Cargo vs. GOH (gross-on-hand?) cargo
with separate weight/CBM/contents per type, carries a "Weighing Receipt" sub-block with its own AWB
barcode, a "For Office use only" security/loading-confirmation section, and a copy-distribution footer
(Original/Shipper/Airline/Security copies) plus revision metadata. All of this is candidate detail for
resolving OQ-3, not yet reflected in any implementation.

### `documents/Air way bill.jpg`

|                                  |                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Document type                    | Air Waybill (MAWB) — standard IATA carrier form                                                                          |
| Source/purpose                   | A real Qatar Airways-issued MAWB (MAWB 157/CMB/41640513)                                                                 |
| Example or standard form         | Real filled instance of the **carrier's** standard layout — Hub Lanka fills this, it does not own the template design    |
| PRD/architecture feature         | Phase 7 — Documents; PRD §9 AWB row; BR-64 (A4 print); OQ-3                                                              |
| Used for UI layout               | Yes — and the authoritative source for OQ-3's AWB manual-field list (IATA/SHC/HS codes, charge codes, AWB exchange rate) |
| Used for calculation validation  | No (its own weight/rate/charge table is a carrier-side calculation, not Hub Lanka's selling-price invoice)               |
| Used for PDF/document generation | Yes — target layout, understanding that Hub Lanka is reproducing a standard IATA MAWB layout, not designing its own      |

### `documents/AWB_Stricker.jpg`

|                                  |                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Document type                    | AWB Sticker / cargo label                                                                                    |
| Source/purpose                   | A real printed carrier-branded (Emirates SkyCargo) label                                                     |
| Example or standard form         | Real instance                                                                                                |
| PRD/architecture feature         | Phase 7 — Documents; PRD §9 AWB Sticker row; BR-62 (Zebra ZD420, 12×8cm)                                     |
| Used for UI layout               | Yes — five fields only (AWB No, Origin, Destination, No. of Pcs, plus the carrier name and Hub Lanka's name) |
| Used for calculation validation  | No                                                                                                           |
| Used for PDF/document generation | Yes — the label layout target for the Zebra ZD420 print path                                                 |

**Notes:** Confirms PRD §9's "carrier-branded" framing — this sample is branded Emirates SkyCargo, meaning
the label template varies by which airline is carrying the shipment; the earlier DEVELOPMENT_PLAN note
"Carrier template selection" is a real, visible requirement here, not a hypothetical.

### `documents/CDN.jpg`

|                                  |                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Document type                    | Cargo Despatch Note / FCL Container Load Plan (SLPA form, EXP 3b)                                                   |
| Source/purpose                   | A real filled CDN, photographed                                                                                     |
| Example or standard form         | Real filled instance                                                                                                |
| PRD/architecture feature         | Phase 7 — Documents; PRD §9 CDN row; BR-65 (A4 print); OQ-3                                                         |
| Used for UI layout               | Yes — and the authoritative source for OQ-3's CDN manual-field list                                                 |
| Used for calculation validation  | No                                                                                                                  |
| Used for PDF/document generation | Yes — target layout; official-use sections (Customs Export Office, SLPA Export Officer) must print blank per PRD §9 |

**Notes:** Numbered fields 1–37 on the real form (shipper/consignee, lorry/trailer, tare weight, SLP no,
agent seal no, driver/cleaner names, voyage/vessel/port details, container marks and numbers, package
description, gross/net weight, cube m³, container type, reefer temperature, CY/CFS/Door delivery
checkboxes, customs and SLPA official-use blocks, declarant details) — substantially more granular than
PRD §9's ten-item summary. Authoritative source for OQ-3.

### `documents/SECURUTY CLEARANCE CERTIFICATE - HUB LANKA.doc (UDANA).doc`

_(Filename preserved exactly as provided, including its typo and parenthetical — do not rename.)_

|                                  |                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Document type                    | Security Clearance Certificate (Hub Lanka's own form)                             |
| Source/purpose                   | A blank template (legacy `.doc`, Word 97-2003 binary format)                      |
| Example or standard form         | **Blank standard company template**, not a filled example                         |
| PRD/architecture feature         | Phase 7 — Documents; PRD §9 Security Clearance row; OQ-2 (paper size, still open) |
| Used for UI layout               | Yes — full field set and exact legal/declaration wording                          |
| Used for calculation validation  | No                                                                                |
| Used for PDF/document generation | Yes — target layout; paper size remains OQ-2, unresolved by this file             |

**Notes:** This `.doc` is a legacy OLE binary format this toolchain cannot open directly. Its text was
extracted read-only (Word COM automation, opened with `ReadOnly:$true`, never saved) to a scratch file
_outside this repository_ purely to document its contents here — **the original `.doc` was never opened
for writing and is untouched.** Three sections: (1) shipper/agent's certification (name, designation,
organization, NIC, AWB No, cargo description, pieces/weight, flight/date, destination, signature, date,
company seal, DGD compliance statement) — matches PRD's "Name, designation, NIC" manual fields; (2) a
"Declaration by the Warf officer/Shipper's/Agent's Representative" handover block (employee name, S/NO,
designation, NIC, signature, date) — matches PRD's "handover... block"; (3) a "Taken charge by" block
(name, staff no, signature, date) — matches PRD's "taken-charge block." Confirms PRD §9's three-part field
description exactly; this file is the authoritative source for the exact legal wording of each section.

## Discrepancies found (flagged, not resolved)

Per rule 3 above, none of these have been fixed in code — they're recorded here for whoever implements the
affected phase.

1. **Invoice LKR line-amount rounding model (Phase 5, AC-13) — resolved by this reference, in two passes.**
   `PRD.md` §8's prose does not by itself make clear how each line's LKR amount is derived. A first pass
   (earlier in this session) concluded "round each line's USD amount, then convert that rounded USD amount
   to LKR and round again" — because summing the five _printed_ LKR line amounts does equal the printed
   TOTAL LKR (845,152.99), which seemed to confirm a round-per-line-then-sum model. **That first pass was
   itself incomplete**: it only checked that the printed _totals_ were consistent with summing the printed
   _line_ amounts — it never checked whether each individual printed _line_ amount could actually be
   re-derived from its own USD amount. Re-deriving them shows it cannot: Screening's rounded USD amount
   (9.33) × 340.50 = 3,176.87, but the invoice prints LKR 3,178.40 for that line — a real, measurable
   mismatch, not rounding noise. The correct model, verified against four of the five lines exactly:
   **each line's USD amount is `round2(rate × weight)`, and that line's LKR amount is
   `round2(rate × weight × exchange rate)` — computed from the same full-precision base, not from the
   already-rounded USD amount.** Screening confirms it precisely: true base 444.50 × 0.021 = 9.3345 →
   USD `round2(9.3345)` = 9.33 (matches the printed 9.33) and LKR `round2(9.3345 × 340.50)` = 3,178.397 →
   3,178.40 (matches the printed 3,178.40 exactly). Freight, MAWB Fee and Handling reconcile exactly either
   way (no hidden precision on those lines). Totals (both currencies) are still the sum of the
   independently-rounded per-line amounts, not a round-of-sum — see discrepancy §2 below for the one line
   (Security) that does _not_ fully reconcile under this corrected model either, and why.
2. **Security Charges' LKR amount has an unresolved ~1-cent gap against the real invoice — flagged, not
   forced.** PRD.md asserts Security's true rate as 36.2594 (unverifiable from the printed 36.26 alone, a
   contradiction with nothing — 36.2594 rounds to 36.26). Applying the corrected model above,
   `round2(36.2594 × 340.50)` = 12,346.33, but the real invoice prints LKR **12,346.34** for this line — one
   cent higher. This is _not_ explained by rounding-mode choice: no rate at 4-decimal precision produces
   exactly 12,346.34 (36.2594 → 12,346.33; 36.2595 → 12,346.36 — the target sits in an unreachable gap
   between adjacent 4dp rates at this exchange rate). Consequently `TOTAL LKR` computed line-by-line from
   PRD's stated precision is 845,152.98, one cent short of the printed 845,152.99. This looks like a small
   inconsistency internal to the one real specimen invoice itself (a manual override or an artifact of
   whatever system Hub Lanka's own invoicing used, not a flaw in the rate/weight/exchange-rate model, which
   the other four lines confirm precisely) — recorded here rather than silently forced to match by picking
   an unconfirmed rate digit. Phase 5's implementation uses the mathematically consistent model throughout
   and does not special-case this one line.
3. **Invoice footer content not mentioned in `PRD.md`/`CONTEXT.md`.** The real invoice has a
   "TRANSFER FUNDS TO (USD)" bank-details block (account name/number, bank name/address/branch, SWIFT,
   bank code) and a four-point "PAYMENT TERMS" block, plus a printed DUE DATE line. `CONTEXT.md` §13
   mentions due date only as a business rule ("Due date follows the credit term"), not as a template field,
   and never mentions the bank-details/payment-terms footer at all. This is real, present-on-every-invoice
   content that Phase 5 will need to decide how to handle (static configuration vs. a flagged open
   question) — not something to silently omit or silently invent from scratch.
4. **Cost Sheet line labels differ from `CONTEXT.md` §12's phrasing**, and from this session's Phase 4
   implementation (`packages/shared/src/costsheet.ts`'s `COST_SHEET_LINE_LABELS`), which followed
   `CONTEXT.md`'s shorter wording. The real form uses the fuller phrasing listed above (e.g. "Transport
   Charges" not "Transport", "Labour Charges" not "Labour", "Inspection Expenses" not "Inspection",
   "Operational Expenses" not "Operational", "Other Expenses" not "Other", and "Animal/Plant Quarantine
   **Charges Receipts**" not just "Animal/Plant Quarantine"). Field _order_ and _count_ (11) already match
   exactly — only the label _wording_ differs. Flagged for correction against this reference, not fixed
   here per this task's scope.
5. **Cost Sheet is missing a header field.** The real form has a "Shift Leader Name" field in its header
   table, distinct from the "Shift leader Signature" line at the bottom. Phase 4's `CostSheet` model has
   `shiftLeaderSignature` but no separate name field — flagged for whoever revisits Phase 4's schema.
6. **AWB is a carrier-issued form, not a Hub Lanka template** — worth calling out explicitly for Phase 7:
   the "layout fidelity" requirement for the AWB means reproducing Qatar Airways' (or whichever carrier's)
   standard IATA MAWB layout, which is a materially different task from the AWB Sticker (carrier-branded
   but Hub-Lanka-issued) or the Security Clearance/CDN/ADF (Hub-Lanka-or-authority-owned templates).

## Missing

None of the eight documents requested are missing — all eight already existed in this repository's working
tree (an untracked `/references` directory with flat files) before this task began; this task's only job
was to organize them into the structure above and document them. No files were added from outside the
project.
