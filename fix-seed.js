const fs = require('fs');
let content = fs.readFileSync('apps/api/prisma/seed.ts', 'utf8');
content = content.replace(/    'masterdata\.manage',\n    'masterdata\.manage',/g, "    'masterdata.manage',");
fs.writeFileSync('apps/api/prisma/seed.ts', content);
