import type { CdnFields } from '@hub-lanka/shared';
import { escapeHtml, htmlDocument } from './template-helpers';

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
  const printDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');

  const pageCss = `
    @page { 
      size: A4 portrait; 
      margin: 6mm 8mm; 
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      height: 100%;
      margin: 0;
      padding: 0;
    }
    body { 
      font-family: "Times New Roman", Times, serif !important; 
      color: #000;
      font-size: 9.5pt;
      line-height: 1.15;
    }
    .page-container {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      page-break-after: avoid;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      table-layout: fixed !important; 
      margin-bottom: -1px; 
    }
    td, th { 
      border: 1px solid #000; 
      padding: 3px 5px !important; 
      vertical-align: top; 
      word-wrap: break-word; 
    }
    .label { 
      font-size: 7.5pt; 
      font-weight: bold; 
      color: #000; 
      margin-bottom: 2px; 
      line-height: 1.1;
    }
    .title { 
      text-align: center; 
      font-size: 11.5pt; 
      font-weight: bold; 
      letter-spacing: 0.5px;
      margin-bottom: 4px; 
      text-transform: uppercase; 
      flex-shrink: 0;
    }
    .dark-cage {
      background-color: #d9d9d9 !important;
    }
    .val-center {
      text-align: center;
    }
    .val-right {
      text-align: right;
    }
    .nose-door-tag {
      border: 1px solid #000; 
      display: inline-block; 
      padding: 2px 10px; 
      font-weight: bold; 
      font-size: 8.5pt;
    }
    .checkbox-square {
      display: inline-block; 
      border: 1px solid #000; 
      width: 12px; 
      height: 12px; 
      vertical-align: middle; 
      margin: 0 2px;
    }
    .flex-table-wrapper {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .flex-table-wrapper > table {
      height: 100%;
    }
    .no-border-top { border-top: none !important; }
    .no-border-bottom { border-bottom: none !important; }
  `;

  const formattedShipperAddress = escapeHtml(viewModel.shipperAddress)?.replace(/\n/g, '<br>') ?? '';
  const formattedConsigneeAddress = escapeHtml(viewModel.consigneeAddress)?.replace(/\n/g, '<br>') ?? '';

  const body = `
<div class="page-container">
  <div class="title">CARGO DESPATCH NOTE/FCL CONTAINER LOAD PLAN - EXP 3b</div>
  
  <!-- Top Section (Shipper / Consignee / Transport Details) -->
  <table>
    <colgroup>
      <col style="width: 50%;">
      <col style="width: 25%;">
      <col style="width: 25%;">
    </colgroup>
    <tr>
      <td rowspan="2" style="height: 64px;">
        <div class="label">1a. Shipper (Name and Address) 3336/7</div>
        <div style="font-weight: bold; font-size: 12pt;">${escapeHtml(viewModel.shipperName) || '&nbsp;'}</div>
        <div style="font-size: 12pt;">${formattedShipperAddress}</div>
      </td>
      <td style="height: 32px;">
        <div class="label">7. Lorry/Trailer No.</div>
        <div>${escapeHtml(fieldData.lorryTrailerNo) || '&nbsp;'}</div>
      </td>
      <td>
        <div class="label">8. SN/(B/L) No.</div>
        <div>${escapeHtml(fieldData.snBlNo) || '&nbsp;'}</div>
      </td>
    </tr>
    <tr>
      <td style="height: 32px;">
        <div class="label">9. Tare Wt. (Kg.)</div>
        <div>${escapeHtml(fieldData.tareWeightKg) || '&nbsp;'}</div>
      </td>
      <td>
        <div class="label">10. SLP No.</div>
        <div>${escapeHtml(fieldData.slpNo) || '&nbsp;'}</div>
      </td>
    </tr>
    <tr>
      <td rowspan="4" style="height: 96px;">
        <div class="label">2b. Consignee :</div>
        <div style="font-weight: bold; font-size: 12pt;">${escapeHtml(viewModel.consigneeName) || '&nbsp;'}</div>
        <div style="font-size: 12pt;">${formattedConsigneeAddress}</div>
      </td>
      <td style="height: 24px;">
        <div class="label">11.(a) Agent Seal no. 9308</div>
        <div>${escapeHtml(fieldData.agentSealNo) || '&nbsp;'}</div>
      </td>
      <td>
        <div class="label">11. (b) Customs Entry No.</div>
        <div>${escapeHtml(viewModel.cusdecNo) || '&nbsp;'}</div>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="height: 24px;">
        <div class="label">12. Name of Driver</div>
        <div>${escapeHtml(fieldData.driverName) || '&nbsp;'}</div>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="height: 24px;">
        <div class="label">13. Name of Cleaner</div>
        <div>${escapeHtml(fieldData.cleanerName) || '&nbsp;'}</div>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="height: 24px;">
        <div class="label">14. Any others Accompanying</div>
        <div>&nbsp;</div>
      </td>
    </tr>
  </table>

  <!-- Mid-Upper Section (Vessel / Voyage Details) -->
  <table>
    <colgroup>
      <col style="width: 12.5%;">
      <col style="width: 12.5%;">
      <col style="width: 12.5%;">
      <col style="width: 12.5%;">
      <col style="width: 50%;">
    </colgroup>
    <tr>
      <td class="dark-cage val-center"><div class="label">2. B</div></td>
      <td class="dark-cage val-center"><div class="label">R</div></td>
      <td class="dark-cage val-center"><div class="label">S</div></td>
      <td class="dark-cage val-center"><div class="label">L</div></td>
      <td style="padding: 3px 5px !important;">
        <div class="label">15. Time of Departure from Accompany/CFS</div>
        <div style="font-size: 7pt; line-height: 1.15; margin-top: 2px;">
          The container / lorry was stuffed / loaded under strict security Condition<br>
          &amp; I certify that this container / lorry is safe to be handled in the Port.
        </div>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="height: 32px;">
        <div class="label">3. A Voyage No./Date 8228</div>
        <div class="val-center">${escapeHtml(fieldData.voyageNoDate) || escapeHtml(viewModel.flightDate) || '&nbsp;'}</div>
      </td>
      <td colspan="2">
        <div class="label">3. b. Ex- Vessel</div>
        <div class="val-center">${escapeHtml(fieldData.vessel) || '&nbsp;'}</div>
      </td>
      <td rowspan="3" style="vertical-align: top;">
        <div class="label">16. Name of certifying security officer/ authorized signatory</div>
        <div style="height: 42px;"></div>
        <div class="label">17. Signature,Designation and Date</div>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="height: 32px;">
        <div class="label">4.Vessel 8122/3</div>
        <div class="val-center">${escapeHtml(viewModel.flightNo) || '&nbsp;'}</div>
      </td>
      <td colspan="2">
        <div class="label">6. Port Loading 3230/1</div>
        <div class="val-center">Colombo</div>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="height: 32px;">
        <div class="label">5. Port of discharge 3414/5</div>
        <div class="val-center">${escapeHtml(fieldData.portDischarge || viewModel.destination) || '&nbsp;'}</div>
      </td>
      <td class="dark-cage">
        <div class="label">Vessel Op Code</div>
      </td>
      <td class="dark-cage">
        <div class="label">Cont Op. Code</div>
      </td>
    </tr>
  </table>

  <!-- Flexible Body Section: Expands dynamically to stretch over the entire page height -->
  <div class="flex-table-wrapper">
    <table>
      <colgroup>
        <col style="width: 25%;">
        <col style="width: 25%;">
        <col style="width: 25%;">
        <col style="width: 12.5%;">
        <col style="width: 12.5%;">
      </colgroup>
      <thead>
        <tr style="height: 28px;">
          <th class="label val-center">18. Marks &amp; Numbers/ Container No.</th>
          <th class="label val-center">19.Number &amp; Kind of Pkgs.</th>
          <th class="label val-center">20. Description of Goods</th>
          <th class="label val-center">21.(a) Gross Wt.<br><span style="font-weight: normal; float: right;">Kg</span></th>
          <th class="label val-center">22. Cube m3</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="no-border-bottom" style="vertical-align: top; padding-top: 8px !important;">
            <div>${escapeHtml(viewModel.mawbNo) || '&nbsp;'}</div>
            <div>&amp;</div>
            <div>Box Nos.</div>
            <div style="margin-top: 8px;">${escapeHtml(fieldData.containerMarksAndNumbers) || ''}</div>
          </td>
          <td class="no-border-bottom val-center" style="vertical-align: top; padding-top: 8px !important;">
            <div class="nose-door-tag" style="margin-bottom: 25px;">NOSE</div>
            <div>(&nbsp;&nbsp;&nbsp;${viewModel.boxCount ?? '&nbsp;&nbsp;&nbsp;'}&nbsp;&nbsp;&nbsp;)&nbsp;&nbsp;&nbsp;Boxes</div>
          </td>
          <td class="no-border-bottom val-center" style="vertical-align: top; padding-top: 8px !important;">
            <div style="margin-bottom: 25px;">Containing</div>
            <div style="font-weight: bold;">${escapeHtml(viewModel.commodityName) || '&nbsp;'}</div>
            <div>${escapeHtml(fieldData.descriptionOfGoods) || ''}</div>
          </td>
          <td class="no-border-bottom val-center" style="vertical-align: top; padding-top: 8px !important;">
            <div>${escapeHtml(viewModel.weightKg) || '&nbsp;'}</div>
          </td>
          <td class="no-border-bottom val-center" style="vertical-align: top; padding-top: 8px !important;">
            <div>${escapeHtml(fieldData.cubeM3) || '&nbsp;'}</div>
          </td>
        </tr>
        <!-- Expanding filler row -->
        <tr style="height: 100%;">
          <td class="no-border-top no-border-bottom"></td>
          <td class="no-border-top no-border-bottom"></td>
          <td class="no-border-top no-border-bottom"></td>
          <td class="no-border-top no-border-bottom"></td>
          <td class="no-border-top no-border-bottom"></td>
        </tr>
        <tr style="height: 40px;">
          <td class="no-border-top"></td>
          <td class="no-border-top val-center" style="vertical-align: bottom; padding-bottom: 6px !important;">
            <div class="nose-door-tag">DOOR</div>
          </td>
          <td class="no-border-top"></td>
          <td style="vertical-align: top;">
            <div class="label">21.(b) Net Wt.<br><span style="font-weight: normal; float: right;">Kg</span></div>
            <div class="val-center">${escapeHtml(fieldData.netWeightKg) || '&nbsp;'}</div>
          </td>
          <td class="no-border-top"></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Bottom Section -->
  <table>
    <colgroup>
      <col style="width: 38%;">
      <col style="width: 17%;">
      <col style="width: 15%;">
      <col style="width: 30%;">
    </colgroup>
    <tr>
      <!-- Column 1: Container / Delivery Specifications -->
      <td rowspan="5" style="vertical-align: top; padding: 4px !important;">
        <div class="label">23. Type of Container</div>
        <div style="font-size: 7.5pt; margin-bottom: 2px;">Height...... Length......Type......</div>
        <div>${escapeHtml(fieldData.containerType) || ''} ${escapeHtml(fieldData.containerHeight) || ''} ${escapeHtml(fieldData.containerLength) || ''}</div>
        
        <div class="label" style="margin-top: 6px;">24. Reefer Temperature Required</div>
        <div style="font-size: 7.5pt; margin-bottom: 2px;">º C &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; º F</div>
        <div>${escapeHtml(fieldData.reeferTemperature) || '&nbsp;'}</div>
        
        <div class="label" style="margin-top: 6px;">25. Place of Delivery</div>
        <div style="font-size: 7.5pt;">
          <span class="checkbox-square"></span> CY &nbsp;
          <span class="checkbox-square"></span> CFS &nbsp;
          <span class="checkbox-square"></span> DOOR
        </div>
        
        <div class="label" style="margin-top: 6px;">26. Place of Receipt</div>
        <div style="font-size: 7.5pt;">
          <span class="checkbox-square"></span> CY &nbsp;
          <span class="checkbox-square"></span> PORT &nbsp;
          <span class="checkbox-square"></span> CFS &nbsp;
          <span class="checkbox-square"></span> DOOR
        </div>
        
        <div class="label" style="margin-top: 6px;">Remarks</div>
        <div style="min-height: 20px;">${escapeHtml(fieldData.remarks) || '&nbsp;'}</div>
      </td>

      <!-- Columns 2 & 3: Official Port / Customs Stations -->
      <td colspan="2" class="dark-cage" style="height: 52px; vertical-align: top;">
        <div class="label">31. Customs Export Office</div>
        <div style="margin-top: 24px; font-size: 7.5pt; display: flex; justify-content: space-between;">
          <span>Date</span><span>Signature</span>
        </div>
      </td>

      <!-- Column 4: Pier Receipt & Declarant Validation -->
      <td rowspan="5" style="vertical-align: top; padding: 0 !important;">
        <div style="padding: 4px;">
          <div style="font-size: 7.5pt; line-height: 1.15;">
            Received ........................... Packages/Containers trailers in apparent good order and Condition.
          </div>
          <div class="label" style="margin-top: 5px;">33. SLPA Supervising Officer/Pier Clerk</div>
          <div style="margin-top: 20px; font-size: 7.5pt; display: flex; justify-content: space-between;">
            <span>Date</span><span>Signature</span>
          </div>
        </div>
        
        <div style="border-top: 1px solid #000; padding: 4px; font-size: 7pt; line-height: 1.15;">
          I certify that the commodities loaded into trailer / lorry mentioned above at our premises were packed in our under strict security conditions and is sate for handling.
        </div>
        
        <div style="border-top: 1px solid #000; padding: 4px;">
          <div class="label">34. Name of Company preparing this Note</div>
          <div style="font-weight: bold;">HUB Lanka (Pvt) Ltd</div>
          
          <div class="label" style="margin-top: 4px;">35. Name of Declarant 3140/1</div>
          <div style="font-weight: bold;">${escapeHtml(fieldData.declarantName) || '&nbsp;'}</div>
          
          <div class="label" style="margin-top: 4px;">36. Telephone No.</div>
          <div>076 012 0210</div>
          
          <div style="display: flex; justify-content: space-between; margin-top: 5px;">
            <span class="label">37. Signature of Declerant</span>
            <span class="label">Date</span>
          </div>
          <div class="val-right" style="margin-top: 3px;">${printDate}</div>
        </div>
      </td>
    </tr>

    <tr>
      <td colspan="2" class="dark-cage" style="height: 52px; vertical-align: top;">
        <div class="label">32. SLPA Export Officer</div>
        <div style="margin-top: 24px; font-size: 7.5pt; display: flex; justify-content: space-between;">
          <span>Date</span><span>Signature</span>
        </div>
      </td>
    </tr>

    <tr>
      <td class="dark-cage" style="height: 28px;"><div class="label">28. (a) Time of Arrival at Customs Gate</div></td>
      <td class="dark-cage"><div class="label">28. (b) Customs Officer</div></td>
    </tr>

    <tr>
      <td class="dark-cage" style="height: 28px;"><div class="label">29. (a) Time of Arrival Alongside</div></td>
      <td class="dark-cage"><div class="label">29. (b) Pier Clerk</div></td>
    </tr>

    <tr>
      <td class="dark-cage" style="height: 28px;"><div class="label">30. (a) Time &amp; Date Documented/Discharged</div></td>
      <td class="dark-cage"><div class="label">30. (b) Supervisor/Pier Clerk</div></td>
    </tr>
  </table>

  <!-- Page Footer Label -->
  <div style="font-weight: bold; font-size: 8pt; margin-top: 2px; flex-shrink: 0;">DARK CAGES FOR OFFICIAL USE ONLY</div>
</div>`;

  return htmlDocument('Cargo Despatch Note', pageCss, body);
}