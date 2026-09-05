import { useAvatarUrl } from '@/features/profile/hooks/useAvatarUrl';
import { cn } from '@/lib/utils';

const SIZE_CLASSES = {
  header: 'size-10 text-xs',
  lg: 'size-20 text-2xl',
} as const;

// eslint-disable-next-line react-refresh/only-export-components -- shared with Avatar.test.tsx, not worth a separate file for one helper
export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const initials = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0]];
  return initials
    .map((part) => part?.[0] ?? '')
    .join('')
    .toUpperCase();
}

/**
 * The user's uploaded profile photo, cropped to a circle with a subtle
 * ring; falls back to initials derived from their actual `fullName` when
 * no photo is set (never a hardcoded/dev-seed-specific initials pair). Used
 * in both the header (`size="header"`, ~40px) and the larger Profile page
 * treatment (`size="lg"`).
 */
export function Avatar({
  fullName,
  hasAvatar,
  size = 'header',
}: {
  fullName: string;
  hasAvatar: boolean;
  size?: keyof typeof SIZE_CLASSES;
}) {
  const url = useAvatarUrl(hasAvatar);
  const sizeClass = SIZE_CLASSES[size];

  if (url) {
    return (
      <img
        src={url}
        alt={fullName}
        className={cn(sizeClass, 'ring-border shrink-0 rounded-full object-cover ring-1')}
      />
    );
  }

  return (
    <span
      className={cn(
        sizeClass,
        'bg-brand-navy text-brand-navy-foreground ring-border flex shrink-0 items-center justify-center rounded-full font-semibold ring-1',
      )}
      aria-hidden="true"
    >
      {getInitials(fullName)}
    </span>
  );
}
