const fs = require('fs');
let file = fs.readFileSync('packages/shared/src/auth.ts', 'utf8');

file = file.replace(
  `  hasAvatar: z.boolean(),`,
  `  hasAvatar: z.boolean(),
  // Whether a signature image is set, fetched from GET /me/signature
  hasSignature: z.boolean(),`
);

fs.writeFileSync('packages/shared/src/auth.ts', file);
