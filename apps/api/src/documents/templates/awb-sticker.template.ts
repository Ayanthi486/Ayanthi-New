import { escapeHtml, htmlDocument } from './template-helpers';

/**
 * BR-62: Zebra ZD420, 12cm x 8cm. Matches references/documents/AWB_Stricker.jpg
 * exactly — five fields, no barcode (the real specimen has none; see the
 * Phase 7 report's decision #8). `carrierName` is the only manual field
 * (PRD §9: "Carrier template selection").
 */
export function renderAwbStickerHtml(
  viewModel: {
    origin: string | null;
    awbNo: string | null;
    destination: string | null;
    boxCount: number | null;
  },
  fieldData: { carrierName?: string },
): string {
  const pageCss = `@page { size: 12cm 8cm; margin: 0; } body { width: 12cm; height: 8cm; padding: 4mm; }`;
  const body = `
<div style="text-align:center; font-weight:bold; font-size:13pt; margin-bottom:6px;">
  ${escapeHtml(fieldData.carrierName || 'CARRIER')}
</div>
<table>
  <tr><td class="label" style="width:30%;">AWB NO</td><td>${escapeHtml(viewModel.awbNo) || '&nbsp;'}</td></tr>
  <tr><td class="label">ORIGIN</td><td>${escapeHtml(viewModel.origin) || '&nbsp;'}</td></tr>
  <tr><td class="label">DESTINATION</td><td>${escapeHtml(viewModel.destination) || '&nbsp;'}</td></tr>
  <tr><td class="label">NO. OF PCS</td><td>${viewModel.boxCount ?? '&nbsp;'}</td></tr>
</table>
<div style="text-align:center; margin-top:8px; font-weight:bold;">HUB Lanka (Pvt) Ltd</div>`;
  return htmlDocument('AWB Sticker', pageCss, body);
}
