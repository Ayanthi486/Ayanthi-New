const fs = require('fs');
let file = fs.readFileSync('apps/api/src/identity/profile.service.ts', 'utf8');

file = file.replace(/\\n}/g, '\n}');

fs.writeFileSync('apps/api/src/identity/profile.service.ts', file);
