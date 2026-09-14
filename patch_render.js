const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/documents/components/DocumentsSection.tsx', 'utf8');

file = file.replace(
  `} else if (readinessQuery.data?.ready) {`,
  `} else if (readinessQuery.data) {`
);

fs.writeFileSync('apps/web/src/features/documents/components/DocumentsSection.tsx', file);
