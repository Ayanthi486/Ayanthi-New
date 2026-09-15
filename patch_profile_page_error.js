const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/profile/pages/ProfilePage.tsx', 'utf8');

// 1. Add event.target.value = '' to handleSignatureFileChange
file = file.replace(
  `  const handleSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;`,
  `  const handleSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    
    setClientFileError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setClientFileError('Please choose a JPEG or PNG image for signature.');
      return;
    }`
);

// 2. Define signatureErrorText
file = file.replace(
  `  const photoErrorText =
    clientFileError ??
    (uploadAvatarMutation.isError
      ? errorMessage(uploadAvatarMutation.error, 'Unable to upload the photo.')
      : removeAvatarMutation.isError
        ? errorMessage(removeAvatarMutation.error, 'Unable to remove the photo.')
        : null);`,
  `  const photoErrorText =
    clientFileError ??
    (uploadAvatarMutation.isError
      ? errorMessage(uploadAvatarMutation.error, 'Unable to upload the photo.')
      : removeAvatarMutation.isError
        ? errorMessage(removeAvatarMutation.error, 'Unable to remove the photo.')
        : null);

  const signatureErrorText =
    clientFileError ??
    (uploadSignatureMutation.isError
      ? errorMessage(uploadSignatureMutation.error, 'Unable to upload the signature.')
      : removeSignatureMutation.isError
        ? errorMessage(removeSignatureMutation.error, 'Unable to remove the signature.')
        : null);`
);

// 3. Render it inside the Signature section
file = file.replace(
  `            <p className="text-muted-foreground text-xs">JPEG or PNG, up to 3MB.</p>
          </div>
        </div>
      </div>`,
  `            <p className="text-muted-foreground text-xs">JPEG or PNG, up to 3MB.</p>
          </div>
        </div>
        {signatureErrorText && <p className="text-destructive text-sm">{signatureErrorText}</p>}
      </div>`
);

fs.writeFileSync('apps/web/src/features/profile/pages/ProfilePage.tsx', file);
