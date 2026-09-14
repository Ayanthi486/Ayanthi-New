const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/costsheet/components/CostSheetSection.tsx', 'utf8');

// Add imports
file = file.replace(
`import {
  useApproveCostSheet,`,
`import { useShipment } from '@/features/shipments/hooks/useShipments';
import type { Shipment } from '@hub-lanka/shared';
import { LOGO_BASE64 } from './logo';
import {
  useApproveCostSheet,`
);

// Update printCostSheet signature
file = file.replace(
`function printCostSheet(costSheet: CostSheet): void {`,
`function printCostSheet(costSheet: CostSheet, shipment: Shipment): void {`
);

// Format flight date
const formatFlightDate = `
  const formatFlightDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return \`\${day}.\${month}.\${year}\`;
  };
`;

// Replace HTML inside printCostSheet
file = file.replace(
`  const rows = COST_SHEET_LINE_TYPES.map((type) => {
    const amount = costSheet.lines.find((line) => line.lineType === type)?.amount;
    const displayAmount = amount ? formatAmount(amount) : '0.00';
    return \`<tr><td>\${escapeHtml(COST_SHEET_LINE_LABELS[type])}</td><td style="text-align:right">\${escapeHtml(displayAmount)}</td></tr>\`;
  }).join('');

  const html = \`<!doctype html>
    <html>
      <head>
        <title>Cost Sheet</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: sans-serif; padding: 2rem; color: #111; }
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          td, th { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
          h1 { margin-bottom: 0.25rem; }
        </style>
      </head>
      <body>
        <h1>Cost Sheet</h1>
        <p>S/N No: \${escapeHtml(costSheet.snNo ?? '—')}</p>
        <table>
          <thead><tr><th>Line</th><th>Amount (LKR)</th></tr></thead>
          <tbody>\${rows}</tbody>
        </table>
        <p><strong>Total: LKR \${escapeHtml(formatAmount(costSheet.total))}</strong></p>
        <p>Remarks: \${escapeHtml(costSheet.remarks ?? '—')}</p>
        <p>Shift Leader Name: \${escapeHtml(costSheet.shiftLeaderSignature ?? '—')}</p>
      </body>
    </html>
  \`;`,
`  const rows = COST_SHEET_LINE_TYPES.map((type) => {
    const amount = costSheet.lines.find((line) => line.lineType === type)?.amount;
    const displayAmount = amount ? formatAmount(amount) : '0.00';
    return \`<tr><td style="border: 1px solid #000; padding: 4px;">\${escapeHtml(COST_SHEET_LINE_LABELS[type])}</td><td style="border: 1px solid #000; padding: 4px; text-align:right;">\${escapeHtml(displayAmount)}</td></tr>\`;
  }).join('');
${formatFlightDate}
  const flightStr = shipment.flightNo ? \`\${escapeHtml(shipment.flightNo)} - \${formatFlightDate(shipment.flightDate)}\` : formatFlightDate(shipment.flightDate);

  const html = \`<!doctype html>
    <html>
      <head>
        <title>Cost Sheet</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #000; font-size: 10pt; }
          table { width: 100%; border-collapse: collapse; }
          td, th { border: 1px solid #000; padding: 4px; text-align: left; vertical-align: middle; }
        </style>
      </head>
      <body>
        <table style="width: 100%; border: none; margin-bottom: 10px;">
          <tr>
            <td style="border: none; padding: 0; text-align: left; vertical-align: top;">
              <div style="font-size: 16pt; font-weight: bold; margin-bottom: 2px; font-family: 'Arial Black', Impact, sans-serif;">H U B Lanka (Pvt) Ltd</div>
              <div style="font-size: 9pt; margin-bottom: 2px;">Terminal 3-1F--17 Air Cargo Village,Katunayake,Sri Lanka.</div>
              <div style="font-size: 9pt;">M +94760120210 |T +94112254879 | E-mail : airportoperations@hublanka.lk</div>
            </td>
            <td style="border: none; padding: 0; text-align: right; vertical-align: top;">
              <img src="\${LOGO_BASE64}" style="height: 60px;" alt="Logo" />
            </td>
          </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9.5pt;">
          <tr>
            <th colspan="4" style="text-align: center; font-size: 11pt; font-weight: bold; padding: 4px; border: 1px solid #000; background-color: #e5e7eb;">
              Shipment Cost Sheet
            </th>
          </tr>
          <tr>
            <td style="width: 25%; font-weight: bold; border: 1px solid #000; padding: 4px;">S/N No</td>
            <td style="width: 25%; border: 1px solid #000; padding: 4px;">\${escapeHtml(costSheet.snNo ?? '')}</td>
            <td style="width: 25%; font-weight: bold; border: 1px solid #000; padding: 4px;">Commodity</td>
            <td style="width: 25%; border: 1px solid #000; padding: 4px;">\${escapeHtml(shipment.commodityName ?? '')}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px;">MAWB No</td>
            <td style="border: 1px solid #000; padding: 4px;">\${escapeHtml(shipment.mawbNo ?? '')}</td>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px;">Boxes</td>
            <td style="border: 1px solid #000; padding: 4px;">\${escapeHtml(shipment.boxCount ?? '')}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px;">Flight No & Date</td>
            <td style="border: 1px solid #000; padding: 4px;">\${flightStr}</td>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px;">Weight</td>
            <td style="border: 1px solid #000; padding: 4px;">\${escapeHtml(shipment.weightKg ?? '')} KGS</td>
          </tr>
          <tr>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px;">Shipper Name</td>
            <td style="border: 1px solid #000; padding: 4px;">\${escapeHtml(shipment.shipperName ?? '')}</td>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px;">Cusdec No</td>
            <td style="border: 1px solid #000; padding: 4px;">\${escapeHtml(shipment.cusdecNo ?? '')}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px;">Consignee Name</td>
            <td style="border: 1px solid #000; padding: 4px;">\${escapeHtml(shipment.consigneeName ?? '')}</td>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px;">Shift Leader Name</td>
            <td style="border: 1px solid #000; padding: 4px;">\${escapeHtml(costSheet.shiftLeaderSignature ?? '')}</td>
          </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
          <thead>
            <tr>
              <th style="font-weight: bold; border: 1px solid #000; padding: 4px; text-align: left; background-color: #e5e7eb;">Expenses</th>
              <th style="font-weight: bold; border: 1px solid #000; padding: 4px; text-align: right; background-color: #e5e7eb;">Amount in LKR</th>
            </tr>
          </thead>
          <tbody>\${rows}</tbody>
          <tfoot>
            <tr>
              <td style="font-weight: bold; border: 1px solid #000; padding: 4px; text-align: right;">Total</td>
              <td style="font-weight: bold; border: 1px solid #000; padding: 4px; text-align: right;">\${escapeHtml(formatAmount(costSheet.total))}</td>
            </tr>
          </tfoot>
        </table>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="font-weight: bold; border: 1px solid #000; padding: 4px; width: 25%; vertical-align: top;">Remarks</td>
            <td style="border: 1px solid #000; padding: 4px; vertical-align: top; min-height: 40px;">\${escapeHtml(costSheet.remarks ?? '')}</td>
          </tr>
        </table>
      </body>
    </html>
  \`;`
);

// Update CostSheetSection props and useShipment
file = file.replace(
`export function CostSheetSection({ shipmentId }: { shipmentId: string }) {
  const costSheetQuery = useCostSheet(shipmentId);
  const createMutation = useCreateCostSheet(shipmentId);`,
`export function CostSheetSection({ shipmentId }: { shipmentId: string }) {
  const costSheetQuery = useCostSheet(shipmentId);
  const shipmentQuery = useShipment(shipmentId);
  const createMutation = useCreateCostSheet(shipmentId);`
);

// Pass shipment to printCostSheet
file = file.replace(
`onClick={() => printCostSheet(costSheet)}>`,
`onClick={() => printCostSheet(costSheet, shipmentQuery.data!)}
            disabled={!shipmentQuery.data}>`
);

fs.writeFileSync('apps/web/src/features/costsheet/components/CostSheetSection.tsx', file);
