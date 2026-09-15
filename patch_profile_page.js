const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/profile/pages/ProfilePage.tsx', 'utf8');

file = file.replace(
  `import { useRemoveAvatar, useUpdateProfile, useUploadAvatar } from '@/features/profile/hooks/useProfile';`,
  `import { useRemoveAvatar, useUpdateProfile, useUploadAvatar, useRemoveSignature, useUploadSignature } from '@/features/profile/hooks/useProfile';
import { downloadSignature } from '@/features/profile/api/profileApi';
import { useEffect } from 'react';`
);

file = file.replace(
  `  const uploadAvatarMutation = useUploadAvatar();
  const removeAvatarMutation = useRemoveAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);`,
  `  const uploadAvatarMutation = useUploadAvatar();
  const removeAvatarMutation = useRemoveAvatar();
  const uploadSignatureMutation = useUploadSignature();
  const removeSignatureMutation = useRemoveSignature();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);`
);

// We need to fetch and display the signature locally if it exists.
const signatureEffect = `
  useEffect(() => {
    let active = true;
    if (user?.hasSignature) {
      downloadSignature()
        .then((blob) => {
          if (active) setSignatureUrl(URL.createObjectURL(blob));
        })
        .catch(() => {});
    } else {
      setSignatureUrl(null);
    }
    return () => { active = false; };
  }, [user?.hasSignature]);
`;

file = file.replace(
  `  if (!user) return null;`,
  `  if (!user) return null;\n` + signatureEffect
);

const handleSignatureFileChange = `
  const handleSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > CLIENT_MAX_BYTES) {
      setClientFileError('Signature must be 3MB or smaller.');
      return;
    }

    uploadSignatureMutation.mutate(file);
  };
`;

file = file.replace(
  `  const photoErrorText =`,
  handleSignatureFileChange + `\n  const photoErrorText =`
);

const signatureUi = `
      <div className="border-border bg-card flex flex-col gap-6 rounded-lg border p-6">
        <div>
          <h2 className="text-lg font-medium">Signature</h2>
          <p className="text-muted-foreground mt-1 text-sm">Upload a transparent image of your signature for use on Cost Sheets.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-32 items-center justify-center rounded-md border border-dashed bg-slate-50 dark:bg-slate-900">
            {signatureUrl ? (
              <img src={signatureUrl} alt="Signature" className="h-full object-contain mix-blend-multiply dark:mix-blend-lighten" />
            ) : (
              <span className="text-xs text-slate-400">No signature</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadSignatureMutation.isPending}
              onClick={() => signatureInputRef.current?.click()}
            >
              {uploadSignatureMutation.isPending ? 'Uploading…' : 'Upload Signature'}
            </Button>
            {user.hasSignature && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removeSignatureMutation.isPending}
                onClick={() => removeSignatureMutation.mutate()}
              >
                {removeSignatureMutation.isPending ? 'Removing…' : 'Remove'}
              </Button>
            )}
          </div>
          <input
            ref={signatureInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            aria-label="Upload signature"
            onChange={handleSignatureFileChange}
          />
        </div>
      </div>
`;

file = file.replace(
  `      <div className="border-border bg-card flex flex-col gap-6 rounded-lg border p-6">
        <form onSubmit={(e) => {`,
  signatureUi + `\n      <div className="border-border bg-card flex flex-col gap-6 rounded-lg border p-6">
        <form onSubmit={(e) => {`
);

fs.writeFileSync('apps/web/src/features/profile/pages/ProfilePage.tsx', file);
