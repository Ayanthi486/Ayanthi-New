import type { SecurityClearanceFields } from '@hub-lanka/shared';
import { escapeHtml, fieldCell, htmlDocument } from './template-helpers';

/**
 * Hub Lanka's own form (references/documents/SECURUTY CLEARANCE CERTIFICATE -
 * HUB LANKA.doc (UDANA).doc — a blank company template, its full legal
 * wording extracted and recorded verbatim in references/README.md). Three
 * sections: shipper/agent certification, warf-officer handover declaration,
 * taken-charge. Paper size is OPEN (OQ-2) — defaults to A4 until confirmed.
 *
 * Direct request: the certification block (name/designation/org/NIC), the
 * Pieces/Weight line, and every date are no longer typed into `fieldData` —
 * they live in `viewModel` instead (preparer's account + Profile, fixed
 * constants, current date, and a deliberately blank Pieces/Weight "space to
 * enter"). Only the handover/taken-charge officer's own fields stay manual.
 */
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
  fieldData: SecurityClearanceFields,
): string {
  const pageCss = `@page { size: A4; margin: 15mm; }`;
  const blank = '<span class="blank">.......................</span>';
  const body = `
<div class="title">HUB LANKA (PVT) LTD</div>
<div style="text-align:center;">Air cargo village, B I A, Katunayake.</div>
<div style="text-align:center; font-weight:bold; margin: 8px 0;">SECURITY CLEARANCE CERTIFICATE</div>

<p>
I ${escapeHtml(viewModel.fullName) || blank}
(Full name of the shipper/agent) being
${escapeHtml(viewModel.designation) || blank} (Designation) of
${escapeHtml(viewModel.organizationName) || blank}
(Name of the organization) holder of National Identity Card Bearing No
${escapeHtml(viewModel.nic) || blank}
hereby confirm that the shipment under Airway Bill bearing No ${escapeHtml(viewModel.awbNo)} consisting of
(Description of Cargo) ${escapeHtml(viewModel.cargoDescription)}. Pieces/Weight
${blank} / ${blank} kg to be uplifted on Flight No &amp; Date
${escapeHtml(viewModel.flightNo)} / ${escapeHtml(viewModel.flightDate)} to ${escapeHtml(viewModel.destination)}
(Destination) has packed, sealed, and transported to the Cargo Complex, Bandaranayke International
Airport, Katunayake under proper security and hygienic conditions. I further certify it is free from any
security and safety hazardous items including weapons, explosives, and dangerous devices, Dangerous
Articles, and dangerous substances.
</p>
<p>
If any part of the shipment contains Dangerous Goods &amp; weapons such parts is/are properly mentioned in
Dangerous Goods Declaration (DGD) and same is complied with the applicable Current IATA Dangerous Goods
Regulations and the other regulatory requirements. I further certify that the aforesaid shipment is fit for
carriage by air.
</p>
<table style="margin-top:12px;">
  <tr><td style="width:50%;">Signature ......................................</td>
      <td>Date ${escapeHtml(viewModel.certificationDate) || '......................................'}</td></tr>
</table>
<p>Company Seal:</p>

<div class="section-title">Declaration by the Warf officer/Shipper's/Agent's Representative</div>
<p>
I declare that the details given above are correct to the best of my knowledge and the aforesaid shipment
was handed over to ${escapeHtml(fieldData.handoverEmployeeName) || '<span class="blank">.......................</span>'}
(Name of the employee), S/NO ${escapeHtml(fieldData.handoverSNo)}
Designation ${escapeHtml(fieldData.handoverDesignation)} in proper condition and that the said shipment is
fit for carriage by Air.
</p>
<table>
  <tr>${fieldCell('NIC No', fieldData.handoverNic)}${fieldCell('Date', viewModel.handoverDate)}</tr>
</table>
<p>Signature ......................................</p>

<div class="section-title">Taken charge by</div>
<table>
  <tr>${fieldCell('Name', fieldData.takenChargeName)}${fieldCell('Staff No', fieldData.takenChargeStaffNo)}${fieldCell('Date', viewModel.takenChargeDate)}</tr>
</table>
<p>Signature ......................................</p>`;
  return htmlDocument('Security Clearance Certificate', pageCss, body);
}
