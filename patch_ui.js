const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/profile/pages/ProfilePage.tsx', 'utf8');

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
          <div className="flex flex-col gap-2">
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
            <p className="text-muted-foreground text-xs">JPEG or PNG, up to 3MB.</p>
          </div>
        </div>
      </div>
`;

// Inject signatureUi BEFORE the final </div> in ProfilePage.tsx
file = file.replace(
  `    </div>
  );`,
  signatureUi + `\n    </div>
  );`
);

fs.writeFileSync('apps/web/src/features/profile/pages/ProfilePage.tsx', file);
