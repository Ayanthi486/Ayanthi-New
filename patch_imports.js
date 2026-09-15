const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/profile/pages/ProfilePage.tsx', 'utf8');

file = file.replace(
  `import {
  useRemoveAvatar,
  useUpdateProfile,
  useUploadAvatar,
} from '@/features/profile/hooks/useProfile';`,
  `import {
  useRemoveAvatar,
  useUpdateProfile,
  useUploadAvatar,
  useRemoveSignature,
  useUploadSignature,
} from '@/features/profile/hooks/useProfile';
import { downloadSignature } from '@/features/profile/api/profileApi';
import { useEffect } from 'react';`
);

fs.writeFileSync('apps/web/src/features/profile/pages/ProfilePage.tsx', file);
