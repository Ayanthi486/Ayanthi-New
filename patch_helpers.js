const fs = require('fs');
let file = fs.readFileSync('apps/api/src/documents/templates/template-helpers.ts', 'utf8');

file = file.replace(
`  \${pageCss}
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; margin: 0; padding: 8mm; color: #000; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #000; padding: 3px 5px; vertical-align: top; font-size: 9pt; }
  .label { font-weight: bold; font-size: 7pt; text-transform: uppercase; color: #333; }
  .title { text-align: center; font-weight: bold; font-size: 13pt; margin-bottom: 6px; }
  .section-title { background: #ddd; font-weight: bold; padding: 3px 5px; font-size: 9pt; }
  .blank { color: #999; }`,
`  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; margin: 0; padding: 8mm; color: #000; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #000; padding: 3px 5px; vertical-align: top; font-size: 9pt; }
  .label { font-weight: bold; font-size: 7pt; text-transform: uppercase; color: #333; }
  .title { text-align: center; font-weight: bold; font-size: 13pt; margin-bottom: 6px; }
  .section-title { background: #ddd; font-weight: bold; padding: 3px 5px; font-size: 9pt; }
  .blank { color: #999; }
  \${pageCss}`
);

fs.writeFileSync('apps/api/src/documents/templates/template-helpers.ts', file);
