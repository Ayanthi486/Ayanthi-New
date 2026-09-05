import type { AwbFields } from '@hub-lanka/shared';
import { escapeHtml, fieldCell, htmlDocument } from './template-helpers';

/** Two-line label+value cell (name + address) — needs a real line break, not an escaped one. */
function nameAddressCell(
  label: string,
  name: string | null,
  address: string | null,
  colspan: number,
): string {
  return `<td colspan="${colspan}"><div class="label">${escapeHtml(label)}</div>${escapeHtml(name)}<br/>${escapeHtml(address)}</td>`;
}

/**
 * Carrier-issued standard IATA MAWB layout (references/documents/Air way
 * bill.jpg — a real Qatar Airways form). Hub Lanka fills this; it does not
 * own the template design (references/README.md discrepancy §6), so the
 * fidelity bar is IATA convention, not company design intent. field_data
 * captures PRD §9's confirmed manual-field groups plus the minimum extra
 * structure the layout needs — not every cell of this extremely dense form.
 */
export function renderAwbHtml(
  viewModel: {
    shipperName: string | null;
    shipperAddress: string | null;
    consigneeName: string | null;
    consigneeAddress: string | null;
    routing: string | null;
    flightNo: string | null;
    flightDate: string;
    grossWeightKg: string | null;
    commodityName: string | null;
    mawbNo: string | null;
  },
  fieldData: AwbFields,
): string {
  const pageCss = `@page { size: A4; margin: 12mm; }`;
  const body = `
<div class="title">AIR WAYBILL — ${viewModel.mawbNo ?? ''}</div>
<table>
  <tr>
    ${nameAddressCell("Shipper's Name and Address", viewModel.shipperName, viewModel.shipperAddress, 2)}
    ${fieldCell('Agent IATA Code', fieldData.agentIataCode)}
    ${fieldCell('Account No', fieldData.accountNo)}
  </tr>
  <tr>
    ${nameAddressCell("Consignee's Name and Address", viewModel.consigneeName, viewModel.consigneeAddress, 2)}
    ${fieldCell('Routing and Destination', viewModel.routing)}
    ${fieldCell('Flight / Date', `${viewModel.flightNo ?? ''} / ${viewModel.flightDate}`)}
  </tr>
  <tr>
    ${fieldCell('Handling Information (SHC)', fieldData.shcCodes, 2)}
    ${fieldCell('HS Commodity Codes', fieldData.hsCommodityCodes, 2)}
  </tr>
  <tr>
    ${fieldCell('Temperature Instructions', fieldData.temperatureInstructions, 2)}
    ${fieldCell('AWB Exchange Rate', fieldData.awbExchangeRate, 2)}
  </tr>
</table>

<table style="margin-top:6px;">
  <tr>
    <th>Rate Class</th><th>Commodity Item No</th><th>Gross Weight (kg)</th><th>Chargeable Weight (kg)</th>
    <th>Rate/Charge</th><th>Total</th><th>Nature and Quantity of Goods</th>
  </tr>
  <tr>
    <td>${escapeHtml(fieldData.rateClass)}</td>
    <td>${escapeHtml(fieldData.commodityItemNo)}</td>
    <td>${escapeHtml(viewModel.grossWeightKg)}</td>
    <td>${escapeHtml(fieldData.chargeableWeightKg)}</td>
    <td>${escapeHtml(fieldData.ratePerKgOrCharge)}</td>
    <td>${escapeHtml(fieldData.totalCharge)}</td>
    <td>${escapeHtml(viewModel.commodityName)}<br/>${escapeHtml(fieldData.natureAndQuantityOfGoods)}</td>
  </tr>
</table>

<table style="margin-top:6px;">
  <tr>
    ${fieldCell('Weight Charge', fieldData.weightCharge)}
    ${fieldCell('Valuation Charge', fieldData.valuationCharge)}
    ${fieldCell('Tax', fieldData.tax)}
  </tr>
  <tr>
    ${fieldCell('AWC', fieldData.otherChargesAwc)}
    ${fieldCell('NEC', fieldData.otherChargesNec)}
    ${fieldCell('CGC', fieldData.otherChargesCgc)}
  </tr>
  <tr>
    ${fieldCell('CHA', fieldData.otherChargesCha)}
    ${fieldCell('FEC', fieldData.otherChargesFec)}
    ${fieldCell('SCC', fieldData.otherChargesScc)}
  </tr>
  <tr>
    ${fieldCell('Total Other Charges Due Agent', fieldData.totalOtherChargesDueAgent)}
    ${fieldCell('Total Other Charges Due Carrier', fieldData.totalOtherChargesDueCarrier)}
  </tr>
  <tr>
    ${fieldCell('Total Prepaid', fieldData.totalPrepaid)}
    ${fieldCell('Total Collect', fieldData.totalCollect)}
  </tr>
</table>

<p style="margin-top:12px;">
Shipper certifies that the particulars on the face hereof are correct and that insofar as any part of the
consignment contains dangerous goods such part is properly described by name and is in proper condition
for carriage by air according to the applicable Dangerous Goods Regulations.
</p>
<table>
  <tr>
    ${fieldCell('Executed on (date)', fieldData.executedOnDate)}
    ${fieldCell('at (place)', fieldData.executedAtPlace)}
  </tr>
</table>
${fieldData.remarks ? `<p><strong>Remarks:</strong> ${escapeHtml(fieldData.remarks)}</p>` : ''}`;
  return htmlDocument('Air Waybill', pageCss, body);
}
