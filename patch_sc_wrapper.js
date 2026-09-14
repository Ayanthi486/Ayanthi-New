const fs = require('fs');
let file = fs.readFileSync('apps/api/src/documents/templates/security-clearance.template.ts', 'utf8');

file = file.replace(
`    body { 
      font-family: "Times New Roman", Times, serif !important; 
      font-size: 10.5pt !important; 
      line-height: 1.35 !important; 
      color: #000 !important; 
    }`,
`    html, body {
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
    }`
);

file = file.replace(
`  const body = \`
<table class="header-table">`,
`  const body = \`
<div class="page-container">
<table class="header-table">`
);

file = file.replace(
`</table>
\`;`,
`</table>
</div>
\`;`
);

fs.writeFileSync('apps/api/src/documents/templates/security-clearance.template.ts', file);
