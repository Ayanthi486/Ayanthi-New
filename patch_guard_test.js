const fs = require('fs');
let file = fs.readFileSync('apps/api/src/identity/guards/jwt-auth.guard.test.ts', 'utf8');

file = file.replace(
  /avatarStorageKey: null/g,
  'avatarStorageKey: null, signatureStorageKey: null'
);
file = file.replace(
  /avatarStorageKey: 'avatars\/some-key\.jpg'/g,
  'avatarStorageKey: "avatars/some-key.jpg", signatureStorageKey: null'
);
file = file.replace(
  /hasAvatar: false/g,
  'hasAvatar: false, hasSignature: false, idCardNo: null'
);
file = file.replace(
  /hasAvatar: true/g,
  'hasAvatar: true, hasSignature: false, idCardNo: null'
);

fs.writeFileSync('apps/api/src/identity/guards/jwt-auth.guard.test.ts', file);
