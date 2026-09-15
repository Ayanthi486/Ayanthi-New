const fs = require('fs');

// 1. types.ts
let types = fs.readFileSync('apps/api/src/identity/types.ts', 'utf8');
types = types.replace(
  `  hasAvatar: boolean;`,
  `  hasAvatar: boolean;
  hasSignature: boolean;`
);
fs.writeFileSync('apps/api/src/identity/types.ts', types);

// 2. auth.controller.ts
let controller = fs.readFileSync('apps/api/src/identity/auth.controller.ts', 'utf8');
controller = controller.replace(
  `      hasAvatar: user.hasAvatar,`,
  `      hasAvatar: user.hasAvatar,
      hasSignature: user.hasSignature,`
);
fs.writeFileSync('apps/api/src/identity/auth.controller.ts', controller);

// 3. auth.service.ts
let service = fs.readFileSync('apps/api/src/identity/auth.service.ts', 'utf8');
service = service.replace(
  `        hasAvatar: user.avatarStorageKey !== null,`,
  `        hasAvatar: user.avatarStorageKey !== null,
        hasSignature: user.signatureStorageKey !== null,`
);
fs.writeFileSync('apps/api/src/identity/auth.service.ts', service);

// 4. jwt-auth.guard.ts
let guard = fs.readFileSync('apps/api/src/identity/guards/jwt-auth.guard.ts', 'utf8');
guard = guard.replace(
  `select: { id: true, email: true, fullName: true, isActive: true, sessionValidFrom: true, avatarStorageKey: true, idCardNo: true },`,
  `select: { id: true, email: true, fullName: true, isActive: true, sessionValidFrom: true, avatarStorageKey: true, signatureStorageKey: true, idCardNo: true },`
);
guard = guard.replace(
  `      hasAvatar: user.avatarStorageKey !== null,`,
  `      hasAvatar: user.avatarStorageKey !== null,
      hasSignature: user.signatureStorageKey !== null,`
);
fs.writeFileSync('apps/api/src/identity/guards/jwt-auth.guard.ts', guard);
