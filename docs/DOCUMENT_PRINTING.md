# Document Printing — Reference, Pipeline and Status

This records, per document type, the real Hub Lanka reference file it must match, the confirmed output
rules, and what has actually been verified versus what remains untested. Written as part of the
pre-production stabilization pass that fixed the Documents section's print actions (see
`docs/UAT_FINDINGS.md` for the bug writeups and `docs/UI_UX_AUDIT.md` for the UI changes).

**Source of truth:** `/references/` (read-only — see its own `README.md` for the full per-file audit).
Nothing here overrides that directory; this file is a print-pipeline-focused summary of it.

## Per-document status

| Document           | Reference file                                                         | Output format                                                   | Print method                                                   | Paper/label size | Readiness gate              | Permissions (action)                                                                  |
| ------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------- | ---------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| Security Clearance | `documents/SECURUTY CLEARANCE CERTIFICATE - HUB LANKA.doc (UDANA).doc` | HTML → browser print; stored PDF on Issue                       | Browser print dialog (`window.print()`)                        | A4               | BOX/WEIGHT                  | View: `documents.manage` or `documents.view.readonly`; Save/Issue: `documents.manage` |
| AWB Sticker        | `documents/AWB_Stricker.jpg`                                           | HTML → browser/label print; **no stored file**                  | Browser print dialog, routed through `PrinterAdapter` at Issue | 12cm × 8cm       | BOX/WEIGHT                  | Same as above                                                                         |
| ADF                | `documents/ADF.jpg`                                                    | On-screen only — **no rendered HTML, no print, no PDF** (BR-63) | N/A — not applicable by design                                 | N/A              | BOX/WEIGHT (to create/edit) | Save: `documents.manage`; View: `documents.manage` or `documents.view.readonly`       |
| AWB                | `documents/Air way bill.jpg`                                           | HTML → browser print; stored PDF on Issue                       | Browser print dialog                                           | A4               | BOX/WEIGHT                  | Same as Security Clearance                                                            |
| CDN                | `documents/CDN.jpg`                                                    | HTML → browser print; stored PDF on Issue                       | Browser print dialog                                           | A4               | BOX/WEIGHT                  | Same as Security Clearance                                                            |

All five paper/label sizes above match `documents.service.ts`'s `PAGE_SIZE_BY_TYPE` map and the task's
confirmed rules exactly; nothing was changed here.

## The print pipeline (as it exists now)

Two genuinely different code paths exist, deliberately:

1. **Print / Preview** (`GET /shipments/:id/documents/:type/print`) — renders the document's HTML live
   (from the current DRAFT's field data, or the frozen snapshot if Issued) and hands it to the browser.
   No Puppeteer, no stored file — this is the "print right now" and "preview on screen" path, and it's
   what "Print"/"Preview" in the UI both call (two independent mutation instances against the same
   endpoint, so their loading/error states don't interfere with each other).
2. **Issue** (`POST /shipments/:id/documents/:type/issue`) — for the three PDF types (Security Clearance,
   AWB, CDN), enqueues a real render job to the `DocumentRenderWorker` (BullMQ + Redis), which runs
   Puppeteer in a separate worker process and saves the resulting PDF via `StorageService` (local disk in
   dev; R2-compatible in the configured environment). For AWB Sticker (no stored file), Issue instead
   calls `PrinterAdapter.print()` directly with the same rendered HTML.

### AWB Sticker / Zebra ZD420

The architecture already matches what's expected: `PrinterAdapter` (`apps/api/src/printing/printer-adapter.ts`)
is an abstract interface; `printing.module.ts` selects the concrete implementation from
`PRINTER_ADAPTER` config (`pdf` → `PdfPrinterAdapter`, `zebra_zd420` → `ZebraZd420Adapter`), so no
document/business code ever references a concrete printer class.

- `PdfPrinterAdapter` is the confirmed-working path: the browser is what actually shows the OS print
  dialog (`window.print()`) — a Node backend has no way to trigger a client's print dialog itself, so this
  adapter's own `.print()` is a logging no-op that exists only so callers go through one interface either
  way.
- `ZebraZd420Adapter` is an **honest stub**: it logs that no ZPL/cable protocol is implemented and falls
  back to the same browser-print behavior. There is no ZD420 hardware in this environment to build or test
  a real cable/ZPL/network protocol against, so nothing was fabricated here — swapping in a real
  implementation later is a one-line change in `printing.module.ts`'s factory, never a call-site change
  anywhere in `documents.service.ts`.
- **Physical printing on the confirmed hardware (Zebra ZD420, cable connection, 12×8cm label) has not
  been tested and cannot be claimed as working.** What _is_ verified (see `docs/UAT_FINDINGS.md`): the
  12cm×8cm `@page` CSS is correct and matches the reference label's five fields exactly; `Issue` reliably
  invokes `PrinterAdapter.print()` with that exact page size (backend e2e test, spying on the injected
  adapter); the browser-print fallback path renders and prints correctly in the same way every other
  document type does. A common real-world way to drive a ZD420 from a browser is installing it as a
  normal system printer via its Windows/OPOS driver and selecting it from the OS print dialog — that
  requires the physical printer and was not available to verify here.

## What changed in this pass (see `docs/UAT_FINDINGS.md` for the full bug list)

- Fixed the actual reported bug: `window.open()` was being called _after_ the print-payload fetch
  resolved (inside a mutation's `onSuccess`), which browsers can silently popup-block since it's no longer
  inside the original click's user-gesture window — and the code's `if (!printWindow) return;` swallowed
  that with zero feedback. The window now opens synchronously inside the click handler (before the fetch),
  and a blocked popup now shows an explicit message instead of doing nothing.
- Added a genuine **Preview** action (inline `<iframe>`, no new window) — previously "Preview" didn't exist
  as a distinct action from "Print."
- Added a server-side readiness re-check to the print endpoint itself (previously only `ensureDraft`/`issue`
  checked BOX/WEIGHT; print did not, even though in practice the UI already hid the whole tab when not
  ready).
- Closed a concurrency gap in `Issue`: two racing Issue calls (double-click, two tabs) could previously
  both pass the "not yet Issued" check and both write, with the last write silently winning. The update is
  now conditioned on `status: 'DRAFT'` in the same statement that flips it to `ISSUED`; the loser gets the
  same 423 "already Issued" error the sequential case already produced, instead of a silent overwrite.
- Print/Preview/Download failures now show a toast instead of failing silently.

## Not done in this pass

- No template layout was redesigned — Security Clearance's three-section wording, the AWB Sticker's five
  fields, and the AWB/CDN A4 layouts were spot-checked against their reference images/text and found to
  already match (see `references/README.md`'s own detailed audit, which predates this pass). A full
  pixel-by-pixel re-render-and-compare against the photographs was not performed — this environment has no
  way to render the generated HTML/PDF and visually diff it against the reference images.
- Physical Zebra ZD420 printing, as stated above, remains untested.
