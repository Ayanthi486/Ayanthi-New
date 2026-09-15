const fs = require('fs');
let file = fs.readFileSync('apps/api/src/identity/profile.service.ts', 'utf8');

file = file.replace(/this\.mapToResponse/g, 'this.toMeResponse');

fs.writeFileSync('apps/api/src/identity/profile.service.ts', file);
