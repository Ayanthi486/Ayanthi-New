const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/documents/components/DocumentsSection.tsx', 'utf8');

file = file.replace(
`  const handleOpen = (document: ShipmentDocument) => {`,
`  const handlePrint = (document: ShipmentDocument) => {
    const printWindow = window.open('about:blank', '_blank');
    downloadMutation.mutate(document.id, {
      onSuccess: (blob) => {
        printFileBlob(blob, printWindow);
      },
      onError: (error) => {
        printWindow?.close();
        showToast(error instanceof ApiClientError ? error.message : 'Unable to print this document.');
      },
    });
  };

  const handleOpen = (document: ShipmentDocument) => {`
);

file = file.replace(
`          <Button
            variant="outline"
            disabled={downloadMutation.isPending}
            onClick={() => handleOpen(document)}
          >
            Download
          </Button>`,
`          <Button
            variant="outline"
            disabled={downloadMutation.isPending}
            onClick={() => handlePrint(document)}
          >
            {downloadMutation.isPending ? 'Preparing…' : 'Print'}
          </Button>
          <Button
            variant="outline"
            disabled={downloadMutation.isPending}
            onClick={() => handleOpen(document)}
          >
            Download
          </Button>`
);

// Add printFileBlob to imports
file = file.replace(`import { cn } from '@/lib/utils';`, `import { cn, printFileBlob } from '@/lib/utils';`);

fs.writeFileSync('apps/web/src/features/documents/components/DocumentsSection.tsx', file);
