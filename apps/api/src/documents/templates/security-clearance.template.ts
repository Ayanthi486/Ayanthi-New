import type { SecurityClearanceFields } from '@hub-lanka/shared';
import { escapeHtml, htmlDocument } from './template-helpers';
import { LOGO_BASE64 } from './logo';

export function renderSecurityClearanceHtml(
  viewModel: {
    awbNo: string | null;
    cargoDescription: string | null;
    boxCount: number | null;
    weightKg: string | null;
    flightNo: string | null;
    flightDate: string;
    destination: string | null;
    shipperName: string | null;
    fullName: string | null;
    designation: string | null;
    organizationName: string | null;
    nic: string | null;
    certificationDate: string | null;
    handoverDate: string | null;
    takenChargeDate: string | null;
  },
  _fieldData: SecurityClearanceFields,
): string {
  const pageCss = `
    @page { size: A4 portrait; margin: 12mm 15mm; }
    html, body {
      height: 100%;
      margin: 0;
      padding: 0;
    }
    body { 
      font-family: "Times New Roman", Times, serif !important; 
      font-size: 10.5pt !important; 
      line-height: 1.35 !important; 
      color: #000 !important; 
    }
    .page-container {
      height: 100%;
      overflow: hidden;
      page-break-after: avoid;
    }
    table td { 
      border: none !important; 
      font-size: 10.5pt !important; 
      font-family: "Times New Roman", Times, serif !important; 
    }
    .header-table { width: 100%; margin-bottom: 0px; }
    .header-text { text-align: center; }
    .header-text h1 { font-size: 16pt; margin: 0 0 2px 0; font-family: "Arial", sans-serif; font-weight: bold; }
    .header-text p { font-size: 10pt; margin: 0; font-weight: bold; }
    .title { 
      text-align: center; 
      font-size: 14pt; 
      font-weight: bold; 
      margin: 10px 0; 
      text-transform: uppercase; 
      font-family: "Arial", sans-serif; 
    }
    .content p { 
      text-align: justify; 
      margin-bottom: 10px; 
    }
    .field-value { 
      font-weight: bold; 
      font-family: "Arial", sans-serif; 
      font-size: 10.5pt;
      display: inline-block;
      text-align: center;
    }
    .sig-table { width: 100%; margin-top: 0px; }
    .sig-table td { vertical-align: bottom; padding-bottom: 2px; }
    .section-title { 
      font-weight: bold; 
      font-size: 12pt; 
      margin: 10px 0 5px 0; 
      text-decoration: underline; 
    }
    hr.divider { border: none; border-top: 1.5px solid #000; margin: 5px 0; }
  `;

  const safeVal = (v: string | null | undefined, padStr: string) => {
    if (!v) return `<span class="field-value" style="letter-spacing: 2px; color: #555;">${padStr}</span>`;
    return `<span class="field-value" style="padding: 0 10px;">${escapeHtml(v)}</span>`;
  };

  const body = `
<div class="page-container">
<table class="header-table">
  <tr>
    <td style="width: 20%;"></td>
    <td class="header-text" style="width: 60%;">
      <h1>HUB LANKA (PVT) LTD</h1>
      <p>Air cargo village, B I A, Katunayake.</p>
      <p>TEL: 0112254879 / 0112254999</p>
      <p>E-MAIL : hublanka@gmail.com</p>
    </td>
    <td style="width: 20%; text-align: right; vertical-align: top;">
      <img src="${LOGO_BASE64}" style="width: 80px; height: auto;" alt="Hub Lanka Logo" />
    </td>
  </tr>
</table>

<hr class="divider" />

<div class="title">SECURITY CLEARANCE CERTIFICATE</div>

<div class="content">
  <p>
    I ${safeVal(viewModel.fullName, '...................................................')} (Full name of the shipper/agent)
    being ${safeVal(viewModel.designation, '...........................................')} (Designation) of ${safeVal(viewModel.organizationName, '...........................................')}
    (Name of the organization) holder of National Identity Card Bearing No ${safeVal(viewModel.nic, '........................................')}
    Hereby confirm that the shipment under <b>Airway Bill bearing No</b> ${safeVal(viewModel.awbNo, '............................................')}
    consisting of <b>(Description of Cargo)</b> ${safeVal(viewModel.cargoDescription, '.......................................')}. 
    <b>Pieces/Weight</b> ${safeVal(viewModel.boxCount ? `${viewModel.boxCount} / ${viewModel.weightKg} kg` : null, '.............................')} to
    be uplifted on <b>Flight No & Date</b> ${safeVal(viewModel.flightNo ? `${viewModel.flightNo} ON ${viewModel.flightDate}` : null, '.......................................')} 
    to ${safeVal(viewModel.destination, '..............')} <b>(Destination)</b> has packed,
    sealed, and transported to the Cargo Complex, Bandaranayke International Airport, Katunayake
    under proper security and hygienic conditions. I further certify it is free from any security and
    safety hazardous items including weapons, explosives, and dangerous devises, Dangerous
    Articles, and dangerous substances.
  </p>
  
  <p>
    If any part of the shipment contains Dangerous Goods & weapons such parts is/are properly
    mentioned in Dangerous Goods Declaration (DGD) and same is complied with the applicable
    Current IATA Dangerous Goods Regulations and the other regulatory requirements.
  </p>
  
  <p>
    I further certify that the aforesaid shipment is fit for carriage by air.
  </p>
</div>

<table class="sig-table">
  <tr>
    <td style="width: 65%;"><b>Signature</b> ........................................</td>
    <td style="width: 35%;"><b>Date</b> ${safeVal(viewModel.certificationDate, '........................................')}</td>
  </tr>
</table>

<p style="margin-top: 5px;">Company Seal:</p>

<div class="section-title">Declaration by the Warf officer/Shipper's/ Agent's Representative</div>

<div class="content">
  <p>
    I declare that the details given above are correct to the best of my knowledge and
    the aforesaid shipment was handed over to ${safeVal(viewModel.fullName, '...................................................')} 
    <b>(Name of the employee), S/NO</b> 
    <b>Designation</b> ${safeVal(viewModel.designation, '.................................')} in proper condition
    and that the said shipment is fit for carriage by Air.
  </p>
</div>

<table class="sig-table">
  <tr>
    <td style="width: 55%; padding-bottom: 10px;">Name ${safeVal(viewModel.fullName, '..........................................')}</td>
    <td style="width: 45%; padding-bottom: 10px;">NIC No ${safeVal(viewModel.nic, '..........................................')}</td>
  </tr>
  <tr>
    <td style="width: 55%;">Signature ........................................</td>
    <td style="width: 45%;">Date ${safeVal(viewModel.certificationDate, '..........................................')}</td>
  </tr>
</table>

<div class="section-title" style="text-decoration: none;">Taken charge by;</div>

<table class="sig-table">
  <tr>
    <td style="width: 55%; padding-bottom: 10px;">Name ${safeVal(null, '..........................................')}</td>
    <td style="width: 45%; padding-bottom: 10px;">Staff No ${safeVal(null, '..........................................')}</td>
  </tr>
  <tr>
    <td style="width: 55%;">Signature ........................................</td>
    <td style="width: 45%;">Date ${safeVal(null, '..........................................')}</td>
  </tr>
</table>
</div>
`;

  return htmlDocument('Security Clearance Certificate', pageCss, body);
}
