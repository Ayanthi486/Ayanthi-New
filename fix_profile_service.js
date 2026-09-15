const fs = require('fs');
let file = fs.readFileSync('apps/api/src/identity/profile.service.ts', 'utf8');

// 1. Fix validateFileKind check
file = file.replace(
  `if (kind !== 'image') {`,
  `if (!kind || kind === 'pdf') {`
);

// 2. Fix the update returning User with extra includes
file = file.replace(
  `include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },`,
  ``
);
file = file.replace(
  `include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },`,
  ``
);

fs.writeFileSync('apps/api/src/identity/profile.service.ts', file);
