const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/costsheet/components/CostSheetSection.tsx', 'utf8');

file = file.replace(
`  const printWindow = window.open('', '_blank');`,
`  const printWindow = window.open('about:blank', '_blank');`
);

file = file.replace(
`  const fullHtml = html + \`<script>window.onload = () => setTimeout(() => { window.print(); }, 200);</script>\`;
  const blob = new Blob([fullHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  printWindow.location.href = url;`,
`  const fullHtml = html + \`<script>window.onload = () => setTimeout(() => { window.print(); }, 200);</script>\`;
  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();`
);

fs.writeFileSync('apps/web/src/features/costsheet/components/CostSheetSection.tsx', file);
