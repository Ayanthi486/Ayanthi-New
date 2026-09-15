const fs = require('fs');
let file = fs.readFileSync('apps/api/src/identity/guards/jwt-auth.guard.test.ts', 'utf8');

file = file.replace(
  /signatureStorageKey: null/g,
  'signatureStorageKey: null, idCardNo: null'
);

fs.writeFileSync('apps/api/src/identity/guards/jwt-auth.guard.test.ts', file);
