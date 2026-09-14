const fs = require('fs');
let file = fs.readFileSync('apps/api/src/documents/templates/security-clearance.template.ts', 'utf8');

file = file.replace(
`  const pageCss = \`
    @page { size: A4; margin: 15mm 20mm; }
    body { 
      font-family: "Times New Roman", Times, serif !important; 
      font-size: 11.5pt !important; 
      line-height: 1.5 !important; 
      color: #000 !important; 
    }
    table td { 
      border: none !important; 
      font-size: 11.5pt !important; 
      font-family: "Times New Roman", Times, serif !important; 
    }
    .header-table { width: 100%; margin-bottom: 5px; }
    .header-text { text-align: center; }
    .header-text h1 { font-size: 18pt; margin: 0 0 5px 0; font-family: "Arial", sans-serif; font-weight: bold; }
    .header-text p { font-size: 11.5pt; margin: 2px 0; font-weight: bold; }
    .title { 
      text-align: center; 
      font-size: 15pt; 
      font-weight: normal; 
      margin: 15px 0; 
      text-transform: uppercase; 
      font-family: "Arial", sans-serif; 
    }
    .content p { 
      text-align: justify; 
      margin-bottom: 15px; 
    }
    .field-value { 
      font-weight: bold; 
      font-family: "Arial", sans-serif; 
      font-size: 11.5pt;
      display: inline-block;
      text-align: center;
    }
    .sig-table { width: 100%; margin-top: 5px; }
    .sig-table td { vertical-align: bottom; padding-bottom: 5px; }
    .section-title { 
      font-weight: bold; 
      font-size: 13pt; 
      margin: 15px 0 8px 0; 
      text-decoration: underline; 
    }
    hr.divider { border: none; border-top: 2px solid #000; margin: 10px 0; }
  \`;`,
`  const pageCss = \`
    @page { size: A4 portrait; margin: 12mm 15mm; }
    body { 
      font-family: "Times New Roman", Times, serif !important; 
      font-size: 10.5pt !important; 
      line-height: 1.35 !important; 
      color: #000 !important; 
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
  \`;`
);

file = file.replace(/padding-bottom: 20px;/g, 'padding-bottom: 10px;');
file = file.replace(/margin-top: 15px;/g, 'margin-top: 5px;');

fs.writeFileSync('apps/api/src/documents/templates/security-clearance.template.ts', file);
