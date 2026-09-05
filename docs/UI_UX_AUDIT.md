# UI/UX Audit — Documents Section

Scope: the Documents tabs on the Shipment View (`apps/web/src/features/documents/components/DocumentsSection.tsx`),
audited and revised as part of fixing document printing (see `docs/UAT_FINDINGS.md`,
`docs/DOCUMENT_PRINTING.md`). Only this section was touched — no other page's UI changed.

## Before

- Tabs rendered (Security Clearance / AWB Sticker / ADF / AWB / CDN), but there was one generic "Print"
  button for every printable type, including AWB Sticker — no visual distinction between an A4 print and a
  12×8cm label print.
- Clicking Print sometimes did nothing, with zero feedback (the popup-block bug — see `UAT_FINDINGS.md`).
- No "Preview" action existed at all.
- Print, Preview (N/A), and Download had no error feedback path — only Save/Issue showed errors.
- The status badge (`DRAFT · v1` / `ISSUED · v2`) was a single flat grey style regardless of status.

## After

Per-type action set, driven entirely by the existing `ISSUABLE_DOCUMENT_TYPES`/`PDF_DOCUMENT_TYPES`
constants and document status — no per-type UI branching was hardcoded beyond what those constants already
encode:

| Type               | Save                                  | Preview       | Print               | Issue       | Download                      |
| ------------------ | ------------------------------------- | ------------- | ------------------- | ----------- | ----------------------------- |
| Security Clearance | while DRAFT                           | ✓             | "Print"             | while DRAFT | when Issued + stored          |
| AWB Sticker        | while DRAFT                           | ✓             | **"Print Sticker"** | while DRAFT | never (no stored file, BR-62) |
| ADF                | while DRAFT (always — never issuable) | **✗ (BR-63)** | **✗ (BR-63)**       | never       | never                         |
| AWB                | while DRAFT                           | ✓             | "Print"             | while DRAFT | when Issued + stored          |
| CDN                | while DRAFT                           | ✓             | "Print"             | while DRAFT | when Issued + stored          |

Other changes:

- **Preview** is a new, genuine action: fetches the same render payload Print uses but shows it inline in
  an `<iframe>` (toggled via the same button, which relabels to "Hide Preview") instead of opening a new
  window — satisfies "document preview area" without adding a second print-like popup flow.
- **Status badge** now colors DRAFT (neutral grey) differently from ISSUED (green), so status is visible
  at a glance without reading the text.
- **Toasts** (reusing the existing app-wide `useToastStore`/`<Toast>`, not a new notification system) now
  surface Print/Preview/Download/Issue failures, and a success toast on Issue. Previously a failure here
  was indistinguishable from nothing having happened at all.
- Buttons continue to use the existing `Button` component and plain text labels — no new icon set or
  visual language was introduced (matches how every other feature section in this app — Invoice, Payment,
  Cost Sheet — already renders its actions).

## Deliberately not done

- **No per-tab "already issued" indicator dot.** Doing this would require eagerly fetching all five
  document types' status up front (today only the active tab's document is fetched), which either means
  calling a query hook in a loop over a fixed-length array (breaks `react-hooks/rules-of-hooks` lint,
  since the linter can't prove the array length never changes) or introducing `useQueries` — a query
  pattern not used anywhere else in this codebase. Given the active tab's own status is already shown
  clearly (badge + "Issued <date>"), and the task's own instruction to avoid "unnecessary empty space" /
  scope growth, this was judged not worth the added complexity for this pass. Flagging it here as a
  legitimate, deferred UX improvement rather than silently dropping it.
- **No separate "Preview" vs "Edit" _mode_ toggle.** The task's example button row lists them as distinct
  actions; this implementation keeps the existing single combined view (resolved shipment fields +
  editable manual fields, always visible together) rather than introducing a mode switch, because (a) the
  fields are already directly editable in place — a separate "Edit" button that just reveals the same
  already-visible inputs would be a button with no real function, which is the same category of problem
  as a fake Print button, and (b) the task explicitly says "do not redesign the form." "Preview" was still
  added as its own distinct action (see above) since it does something Print/the inline view don't:
  shows the actual rendered document output without leaving the page or opening a window.
- **No visual redesign of the tab strip itself** — tabs, spacing, and the readiness-blocked message
  banner are unchanged; the task's UX asks here were about _actions_, not the tab chrome.

## Verification

- `apps/web/src/features/documents/components/DocumentsSection.test.tsx` — 10 tests (4 pre-existing + 6
  new), covering the action-set-per-type table above, the Print/Preview/Download error and success paths,
  and the AWB Sticker label. All passing — see `docs/UAT_FINDINGS.md` for the full test run.
- **Not verified in an actual browser** — no browser automation connection was available in this
  environment. The button/permission/status logic is covered by component tests against a mocked API, not
  by a real click-through of the running app. Recommend a manual pass (the exact steps in the original
  task's "Manual browser verification" section) before sign-off.
