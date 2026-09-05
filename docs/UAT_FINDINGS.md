# UAT Findings — Document Printing

Investigation triggered by: "the Documents section renders the tabs, but I cannot print the documents from
the UI." This records what was found, what was fixed, and how each fix was verified.

## Root cause

The Documents section's backend (readiness, templates, PDF rendering via a real BullMQ/Puppeteer worker,
storage, the `PrinterAdapter` abstraction) was already substantially built and already covered by
extensive backend e2e tests — that part was not broken. The actual reported symptom traced to a single,
concrete frontend bug in `apps/web/src/features/documents/components/DocumentsSection.tsx`:

```ts
// before
const handlePrint = () => {
  printMutation.mutate(undefined, {
    onSuccess: ({ html }) => {
      const printWindow = window.open('', '_blank', 'noopener,noreferrer');
      if (!printWindow) return; // <- silent failure
      ...
    },
  });
};
```

`window.open()` was called _after_ the print-payload fetch resolved, inside the mutation's `onSuccess`
callback. Browsers track whether a `window.open()` call happens within the same synchronous turn as a
direct user gesture (a click); once an `await`/network round-trip has happened, that window has expired,
and Chrome/Firefox silently popup-block the call. The `if (!printWindow) return;` guard then discarded the
failure with no user-visible feedback at all — from the user's side, clicking "Print" simply did nothing,
which matches the report exactly.

## Bugs found

1. **Print silently fails when the browser blocks the popup** (the reported bug). Root cause and fix above.
2. **No error feedback for Print, Preview, or Download failures at all.** Only `Save`/`Issue` had error
   text. A failed print/download request (permission error, 404, 500) produced no visible feedback — from
   the user's perspective this is indistinguishable from bug #1, "nothing happens."
3. **AWB Sticker's print action was unlabeled as anything special** — same generic "Print" button as the
   A4 documents, despite being a fundamentally different output (12×8cm label vs A4 page) with its own
   confirmed hardware path.
4. **No "Preview" action existed** — only "Print" (which also opens a new window). There was no way to see
   a document's rendered output without going through the full print flow.
5. **`GET .../print` had no server-side readiness check.** `ensureDraft` and `issue` both correctly reject
   with the confirmed message when BOX/WEIGHT are missing; the print endpoint did not, and returned
   rendered HTML with blank box/weight fields instead. In practice the frontend already hides the whole
   document tab when not ready, so this wasn't reachable through the normal UI — but it is a real gap
   against "readiness must be enforced server-side, not just relied on in the frontend," and is reachable
   if a shipment's cargo data were ever cleared after a draft document already existed.
6. **Concurrent double-Issue race.** `issue()`'s final write updated the row unconditionally
   (`where: { id: latest.id }`), guarded only by an _earlier_, separate read of `latest.status`. Two
   Issue requests racing (double-click, or two browser tabs) could both pass that earlier check while the
   document was still DRAFT, both render, and both write — the second write would silently overwrite the
   first's `storageKey`/snapshot with no error, leaving an orphaned rendered file with no reference to it.

## Bugs fixed

| #   | Fix                                                                                                                                                                                         | File                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | `window.open()` moved to fire synchronously inside the click handler (before the fetch); a blocked popup now shows an explicit toast instead of returning silently                          | `DocumentsSection.tsx` |
| 2   | Added `onError` toasts to Print, Preview, Download and Issue                                                                                                                                | `DocumentsSection.tsx` |
| 3   | AWB Sticker's print button now reads "Print Sticker"                                                                                                                                        | `DocumentsSection.tsx` |
| 4   | Added a genuine Preview action (inline `<iframe>`, independent loading state from Print)                                                                                                    | `DocumentsSection.tsx` |
| 5   | Added a `computeDocumentReadiness` re-check to `getPrintPayload` for non-Issued documents                                                                                                   | `documents.service.ts` |
| 6   | `issue()`'s write is now a conditional `updateMany({ where: { id, status: 'DRAFT' } })`; a 0-row result throws the same `LockedError` the sequential "already Issued" case already produced | `documents.service.ts` |

## Verification performed

- **Backend**, against the real running stack (Postgres + Redis, real Puppeteer worker, no mocks) —
  `apps/api/test/documents.e2e-spec.ts`, run twice to rule out flakiness: **15/15 files, 143/143 tests
  passed both times.** New assertions added and passing:
  - `PrinterAdapter.print()` is actually invoked at AWB Sticker Issue, with `pageSize: '12cm x 8cm'`
    (spied on the injected abstraction, not a concrete class — proves the architecture, not just the
    behavior).
  - Print is blocked with the exact confirmed message when BOX/WEIGHT are missing on an existing DRAFT
    (this specific path isn't reachable through any real cargo-update flow — box/weight can't be
    un-set once entered — so the test writes directly around the API to exercise the server-side backstop).
  - A concurrent double-Issue (`Promise.all` of two Issue calls) always produces exactly one `201` and one
    `423`, and exactly one `ShipmentDocument` row ends up `ISSUED` — never a silent duplicate/overwrite.
  - All pre-existing coverage (readiness blocking, ADF's no-issue/no-print rejection, Security Clearance's
    real Puppeteer PDF with `%PDF-` magic-byte verification, immutability of Issued documents, stale-Issued
    document opening a new DRAFT version on shipment edit, unauthenticated/unauthorized file-URL rejection,
    audit-row writes) — unaffected, still green.
- **Frontend**, `apps/web/src/features/documents/components/DocumentsSection.test.tsx` — 10 tests,
  including new ones asserting: `window.open` fires synchronously (before the fetch resolves) and is later
  filled with the fetched HTML; a blocked popup shows a message and never even attempts the print fetch; a
  failed print/download shows a toast rather than nothing; Preview toggles an inline frame without opening
  a window; AWB Sticker's button reads "Print Sticker"; ADF shows neither Print nor Preview.
- **Full validation suite**: frontend unit tests, backend unit tests, backend e2e tests (above),
  typecheck, and lint all pass across the whole monorepo; production build succeeds. See the final report
  in-conversation for the exact run output.
- **Manual browser verification (login → open shipment → Documents → exercise each tab) was not
  performed** — no browser automation connection was available in this environment (checked at the start
  and end of this task). This is a real gap: the fixes are verified at the unit/e2e level, not by actually
  clicking through the running application. Recommend a manual pass before considering this closed.
- **Physical Zebra ZD420 printing was not tested** — no hardware available. See `docs/DOCUMENT_PRINTING.md`
  for exactly what is and isn't verified about that path.

## Permissions — re-verified, unchanged

`documents.manage` (Executive, Manager) can create/edit/print/preview/issue/download.
`documents.view.readonly` (Director) can view/print/preview/download but not create/edit/issue. Both were
already enforced server-side before this pass (`checkManagePermission`/`checkViewPermission` in
`documents.service.ts`) and remain unchanged; nothing here weakens or bypasses them, and no permission
check was moved to the frontend.
