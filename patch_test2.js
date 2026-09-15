const fs = require('fs');
let file = fs.readFileSync('apps/api/src/documents/documents.util.test.ts', 'utf8');

file = file.replace(
`        mawbNo: '157 0659 8944',
  airline: { code: 'QR' },`,
`        mawbNo: '157 0659 8944',`
);

fs.writeFileSync('apps/api/src/documents/documents.util.test.ts', file);
