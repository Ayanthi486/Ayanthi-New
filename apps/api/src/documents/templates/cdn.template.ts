import type { CdnFields } from '@hub-lanka/shared';
import { escapeHtml, fieldCell, htmlDocument } from './template-helpers';

/**
 * Statutory SLPA form (references/documents/CDN.jpg — Cargo Despatch Note /
 * FCL Container Load Plan, EXP 3b), numbered fields preserved. Official-use
 * sections (Customs Export Office, SLPA Export/Supervising Officer) print
 * blank per PRD §9 — no data is captured for those cells.
 */
export function renderCdnHtml(
  viewModel: {
    shipperName: string | null;
    shipperAddress: string | null;
    consigneeName: string | null;
    consigneeAddress: string | null;
    flightNo: string | null;
    flightDate: string;
    destination: string | null;
    mawbNo: string | null;
    boxCount: number | null;
    weightKg: string | null;
    commodityName: string | null;
    cusdecNo: string | null;
  },
  fieldData: CdnFields,
): string {
  const pageCss = `@page { size: A4; margin: 12mm; }`;
  const body = `
<div class="title">CARGO DESPATCH NOTE/FCL CONTAINER LOAD PLAN - EXP 3b</div>
<table>
  <tr>
    <td rowspan="2" style="width:50%;"><div class="label">1a. Shipper (Name and Address)</div>
      ${escapeHtml(viewModel.shipperName)}<br/>${escapeHtml(viewModel.shipperAddress)}</td>
    ${fieldCell('7. Lorry/Trailer No.', fieldData.lorryTrailerNo)}
    ${fieldCell('8. SN/(B/L) No.', fieldData.snBlNo)}
  </tr>
  <tr>
    ${fieldCell('9. Tare Wt. (Kg.)', fieldData.tareWeightKg)}
    ${fieldCell('10. SLP No.', fieldData.slpNo)}
  </tr>
  <tr>
    <td rowspan="4"><div class="label">2b. Consignee</div>
      ${escapeHtml(viewModel.consigneeName)}<br/>${escapeHtml(viewModel.consigneeAddress)}</td>
    ${fieldCell('11.(a) Agent Seal No.', fieldData.agentSealNo)}
    ${fieldCell('11.(b) Customs Entry No.', viewModel.cusdecNo)}
  </tr>
  <tr>${fieldCell('12. Name of Driver', fieldData.driverName, 2)}</tr>
  <tr>${fieldCell('13. Name of Cleaner', fieldData.cleanerName, 2)}</tr>
  <tr>${fieldCell('14. Any others accompanying', '', 2)}</tr>
</table>

<table style="margin-top:4px;">
  <tr>
    ${fieldCell('3.a Voyage No./Date', fieldData.voyageNoDate)}
    ${fieldCell('3.b Ex-Vessel', fieldData.vessel)}
    ${fieldCell('4. Vessel', viewModel.flightNo)}
  </tr>
  <tr>
    ${fieldCell('6. Port Loading', fieldData.portLoading)}
    ${fieldCell('5. Port of Discharge', fieldData.portDischarge || viewModel.destination)}
    ${fieldCell('Date', viewModel.flightDate)}
  </tr>
</table>

<table style="margin-top:4px;">
  <tr>
    <th>18. Marks &amp; Numbers/Container No.</th>
    <th>19. Number &amp; Kind of Pkgs.</th>
    <th>20. Description of Goods</th>
    <th>21.(a) Gross Wt.</th>
    <th>22. Cube m3</th>
  </tr>
  <tr>
    <td>${escapeHtml(viewModel.mawbNo)}<br/>${escapeHtml(fieldData.containerMarksAndNumbers)}</td>
    <td>${viewModel.boxCount ?? ''} Boxes</td>
    <td>${escapeHtml(viewModel.commodityName)}<br/>${escapeHtml(fieldData.descriptionOfGoods)}</td>
    <td>${escapeHtml(viewModel.weightKg)}</td>
    <td>${escapeHtml(fieldData.cubeM3)}</td>
  </tr>
</table>

<table style="margin-top:4px;">
  <tr>
    ${fieldCell('23. Type of Container / Height / Length', `${fieldData.containerType ?? ''} / ${fieldData.containerHeight ?? ''} / ${fieldData.containerLength ?? ''}`)}
    ${fieldCell('24. Reefer Temperature Required', fieldData.reeferTemperature)}
  </tr>
  <tr>
    ${fieldCell('25. Place of Delivery (CY/CFS/DOOR)', fieldData.placeOfDelivery)}
    ${fieldCell('26. Place of Receipt (CY/PORT/CFS/DOOR)', fieldData.placeOfReceipt)}
  </tr>
  <tr>${fieldCell('Remarks', fieldData.remarks, 2)}</tr>
</table>

<table style="margin-top:4px;">
  <tr><td class="section-title" colspan="2">31. Customs Export Office</td><td class="section-title">33. SLPA Supervising Officer / Pier Clerk</td></tr>
  <tr><td colspan="2" style="height:40px;">&nbsp;</td><td style="height:40px;">&nbsp;</td></tr>
  <tr><td class="section-title" colspan="2">32. SLPA Export Officer</td><td>&nbsp;</td></tr>
  <tr><td colspan="2" style="height:40px;">&nbsp;</td><td>&nbsp;</td></tr>
</table>

<table style="margin-top:4px;">
  <tr>
    ${fieldCell('28.(a) Time of Arrival at Customs Gate', '')}
    ${fieldCell('28.(b) Customs Officer', '')}
  </tr>
  <tr>
    ${fieldCell('29.(a) Time of Arrival Alongside', '')}
    ${fieldCell('29.(b) Pier Clerk', '')}
  </tr>
  <tr>
    ${fieldCell('30.(a) Time &amp; Date Documented/Discharged', '')}
    ${fieldCell('30.(b) Supervisor/Pier Clerk', '')}
  </tr>
  <tr>
    ${fieldCell('34. Name of Company preparing this Note', 'HUB Lanka (Pvt) Ltd')}
    ${fieldCell('35. Name of Declarant', fieldData.declarantName)}
  </tr>
  <tr>
    ${fieldCell('36. Telephone No.', fieldData.telephoneNo)}
    ${fieldCell('37. Signature of Declarant / Date', '')}
  </tr>
</table>
<p style="font-weight:bold; margin-top:8px;">DARK CAGES FOR OFFICIAL USE ONLY</p>`;
  return htmlDocument('Cargo Despatch Note', pageCss, body);
}
