const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/documents/components/DocumentsSection.tsx', 'utf8');

file = file.replace(
`      onSuccess: ({ html }) => {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      },`,
`      onSuccess: ({ html }) => {
        const fullHtml = html + \`<script>window.onload = () => setTimeout(() => { window.print(); }, 200);</script>\`;
        const blob = new Blob([fullHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        printWindow.location.href = url;
      },`
);

fs.writeFileSync('apps/web/src/features/documents/components/DocumentsSection.tsx', file);
