const fs = require('fs');
let file = fs.readFileSync('apps/api/src/documents/documents.service.ts', 'utf8');

file = file.replace(
  /if \(\!readiness\.ready && type !== 'SECURITY_CLEARANCE'\) throw new BusinessRuleError\(DOCUMENT_BLOCKED_MESSAGE\);/g,
  `if (!readiness.ready && type !== 'SECURITY_CLEARANCE' && type !== 'CDN') throw new BusinessRuleError(DOCUMENT_BLOCKED_MESSAGE);`
);

fs.writeFileSync('apps/api/src/documents/documents.service.ts', file);
