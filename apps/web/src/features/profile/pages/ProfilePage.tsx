import { useRef, useState } from 'react';
import { Avatar } from '@/components/shared/Avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useRemoveAvatar,
  useUpdateProfile,
  useUploadAvatar,
} from '@/features/profile/hooks/useProfile';
import { ApiClientError } from '@/lib/apiClient';
import { useAuthStore } from '@/lib/authStore';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
// Client-side hint only — a courtesy so most bad picks are caught before an
// upload round-trip. The server's AVATAR_MAX_SIZE_MB is the real limit.
const CLIENT_MAX_BYTES = 3 * 1024 * 1024;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiClientError ? error.message : fallback;
}

/**
 * Self-service "my profile" page — full name and photo are editable; email
 * and role are read-only (role changes are an authorization concern, kept
 * on the admin-only Users page, not here — ARCHITECTURE §9). Reachable from
 * every role via ProfileMenu's "Profile" item, no permission gate: everyone
 * who is logged in has exactly one profile, their own.
 */
export function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const updateProfileMutation = useUpdateProfile();
  const uploadAvatarMutation = useUploadAvatar();
  const removeAvatarMutation = useRemoveAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [idCardNo, setIdCardNo] = useState(user?.idCardNo ?? '');
  const [clientFileError, setClientFileError] = useState<string | null>(null);

  if (!user) return null;

  const isDirty =
    (fullName.trim() !== user.fullName && fullName.trim().length > 0) ||
    idCardNo.trim() !== (user.idCardNo ?? '');

  const handleSave = () => {
    const trimmed = fullName.trim();
    if (!trimmed) return;
    updateProfileMutation.mutate({ fullName: trimmed, idCardNo: idCardNo.trim() });
  };

  const handleCancel = () => {
    setFullName(user.fullName);
    setIdCardNo(user.idCardNo ?? '');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still fires onChange.
    event.target.value = '';
    if (!file) return;

    setClientFileError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setClientFileError('Please choose a JPEG or PNG image.');
      return;
    }
    if (file.size > CLIENT_MAX_BYTES) {
      setClientFileError('Image must be 3MB or smaller.');
      return;
    }

    uploadAvatarMutation.mutate(file);
  };

  const photoErrorText =
    clientFileError ??
    (uploadAvatarMutation.isError
      ? errorMessage(uploadAvatarMutation.error, 'Unable to upload the photo.')
      : removeAvatarMutation.isError
        ? errorMessage(removeAvatarMutation.error, 'Unable to remove the photo.')
        : null);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-muted-foreground mt-1 text-sm">Your account identity and photo.</p>
      </div>

      <div className="border-border bg-card flex flex-col gap-6 rounded-lg border p-6">
        <div className="flex items-center gap-4">
          <Avatar fullName={user.fullName} hasAvatar={user.hasAvatar} size="lg" />
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadAvatarMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadAvatarMutation.isPending ? 'Uploading…' : 'Change photo'}
              </Button>
              {user.hasAvatar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={removeAvatarMutation.isPending}
                  onClick={() => removeAvatarMutation.mutate()}
                >
                  {removeAvatarMutation.isPending ? 'Removing…' : 'Remove'}
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              aria-label="Upload profile photo"
              onChange={handleFileChange}
            />
            <p className="text-muted-foreground text-xs">JPEG or PNG, up to 3MB.</p>
          </div>
        </div>

        {photoErrorText && <p className="text-destructive text-sm">{photoErrorText}</p>}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-full-name">Full name</Label>
            <Input
              id="profile-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-id-card-no">NIC No</Label>
            <Input
              id="profile-id-card-no"
              value={idCardNo}
              onChange={(e) => setIdCardNo(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Used to auto-fill the Security Clearance certificate's NIC field.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={user.email} disabled readOnly />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-role">Role</Label>
            <Input id="profile-role" value={user.roles.join(', ')} disabled readOnly />
          </div>
        </div>

        {isDirty && (
          <div className="flex gap-2">
            <Button type="button" disabled={updateProfileMutation.isPending} onClick={handleSave}>
              {updateProfileMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={updateProfileMutation.isPending}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </div>
        )}

        {updateProfileMutation.isError && (
          <p className="text-destructive text-sm">
            {errorMessage(updateProfileMutation.error, 'Unable to save changes.')}
          </p>
        )}
      </div>
    </div>
  );
}
