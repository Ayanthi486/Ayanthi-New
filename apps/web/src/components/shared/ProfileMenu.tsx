import { Activity, ChevronDown, LogOut, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/shared/Avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Compact avatar-and-chevron trigger opening a dropdown with the
 * authenticated user's name/role/email, a link to their own Profile page,
 * and Sign out (Radix DropdownMenu: keyboard nav, Escape, click-outside,
 * and focus management come for free). Replaces the previous loose
 * "name · role" text + standalone Sign out button in the header (UX
 * refinement §3/§6).
 *
 * `hasAvatar` comes straight from the authenticated user (never hardcoded)
 * — `Avatar` renders the uploaded photo when set, or initials derived from
 * the real `fullName` otherwise (never a dev-seed-specific fallback).
 *
 * `showSystemStatus` surfaces the technical System Status page here rather
 * than in the primary business nav — it's the app's existing account/
 * administration entry point, so this reuses it instead of standing up a
 * new Settings shell around a single page. "Profile" (self-service name/
 * photo) is always shown — every authenticated user has one, unlike
 * System Status which is permission-gated.
 *
 * The trigger's own tinted `bg-profile-surface` keeps this section visually
 * distinct from PrimaryNavigation's tinted band next to it — same brand-navy
 * family, but a separately-scoped surface so profile never reads as part of
 * the nav group.
 */
export function ProfileMenu({
  fullName,
  email,
  roles,
  hasAvatar,
  showSystemStatus = false,
  onSignOut,
}: {
  fullName: string;
  email: string;
  roles: string[];
  hasAvatar: boolean;
  showSystemStatus?: boolean;
  onSignOut: () => void;
}) {
  const roleLabel = roles.join(', ');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Open profile menu for ${fullName}${roleLabel ? `, ${roleLabel}` : ''}`}
          className="focus-visible:ring-brand-navy bg-profile-surface hover:bg-profile-surface-hover flex shrink-0 items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <Avatar fullName={fullName} hasAvatar={hasAvatar} size="header" />
          <ChevronDown className="text-muted-foreground size-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar fullName={fullName} hasAvatar={hasAvatar} size="header" />
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-medium">{fullName}</p>
            <p className="text-muted-foreground truncate text-xs">{roleLabel}</p>
            <p className="text-muted-foreground truncate text-xs">{email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <UserRound aria-hidden="true" />
            Profile
          </Link>
        </DropdownMenuItem>
        {showSystemStatus && (
          <DropdownMenuItem asChild>
            <Link to="/settings/system-status">
              <Activity aria-hidden="true" />
              System Status
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onSignOut}>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
