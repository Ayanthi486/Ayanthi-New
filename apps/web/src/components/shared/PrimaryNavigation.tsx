import {
  BarChart3,
  Boxes,
  Database,
  LayoutDashboard,
  MapPin,
  Plane,
  Ship,
  Table2,
  Users as UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { PermissionKey } from '@hub-lanka/shared';
import { RequirePermission } from '@/app/RequirePermission';
import { cn } from '@/lib/utils';

export interface NavItem {
  label: string;
  to: string;
  /** Only match this route exactly, not as a prefix of a nested route. */
  end?: boolean;
  icon: LucideIcon;
  /** Omit for links with no permission gate (e.g. the dashboard). */
  permission?: PermissionKey;
}

/**
 * Same routes and permission gates as the original header (ARCHITECTURE §3 —
 * presentation only, the server enforces every one of these independently).
 * "Cargo Handling" / "Cost Sheets" / "Invoices" / "Payments" / "Documents"
 * live as tabs inside the shipment detail view, not standalone routes, so
 * they are not top-level nav links. System Status is a technical/admin page,
 * not a business destination — it lives in the ProfileMenu instead of here
 * (see AppHeader/ProfileMenu), so this list stays focused on actual work.
 */
// eslint-disable-next-line react-refresh/only-export-components -- shared with AppHeader's mobile nav panel
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Shipments', to: '/shipments', icon: Ship, permission: 'shipment.view' },
  {
    label: 'Master Data',
    to: '/masterdata/shippers',
    icon: Database,
    // Broader than masterdata.manage — see masterdata.shipper.create.
    permission: 'masterdata.shipper.create',
  },
  {
    label: 'Commodities',
    to: '/masterdata/commodities',
    icon: Boxes,
    permission: 'masterdata.commodity.create',
  },
  {
    label: 'Airports',
    to: '/masterdata/airports',
    icon: MapPin,
    permission: 'masterdata.airport.create',
  },
  {
    label: 'Flight',
    to: '/masterdata/flights',
    icon: Plane,
    permission: 'masterdata.flight.create',
  },
  { label: 'Rate Table', to: '/rates', icon: Table2, permission: 'rate.table.manage' },
  { label: 'Analytics', to: '/analytics', icon: BarChart3, permission: 'analytics.view' },
  { label: 'Users', to: '/users', icon: UsersIcon, permission: 'identity.user.manage' },
];

/**
 * A single nav link. `mobile` switches to a full-width row with a left
 * accent bar (for the collapsed panel, which sits on plain white below the
 * header, not on the tinted nav surface); the default is the compact
 * horizontal desktop/tablet treatment, which sits on top of
 * PrimaryNavigation's tinted surface. Only the active item gets a solid
 * background — inactive items stay plain text with a light hover tint, so
 * the nav reads as one grouped region rather than a row of pills
 * (visual refinement — active item must be "obvious," inactive items
 * "lower emphasis," never a pill around every item).
 */
export function NavLinkItem({
  item,
  mobile,
  onNavigate,
}: {
  item: NavItem;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-2 rounded-md text-sm font-medium transition-colors',
          'focus-visible:ring-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          mobile ? 'border-l-4 px-3 py-2.5' : 'px-2.5 py-1.5 whitespace-nowrap lg:px-2 xl:px-3',
          isActive
            ? cn(
                'text-nav-active-foreground font-semibold',
                mobile && 'border-l-brand-gold',
              )
            : cn(
                'text-muted-foreground hover:bg-nav-surface-hover hover:text-foreground',
                mobile && 'border-l-transparent',
              ),
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && !mobile && (
            <motion.div
              layoutId="nav-indicator-desktop"
              className="bg-nav-active absolute inset-0 rounded-md"
              initial={false}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            />
          )}
          {isActive && mobile && (
            <motion.div
              layoutId="nav-indicator-mobile"
              className="bg-nav-active/10 absolute inset-0 -z-10 rounded-r-md"
              initial={false}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <Icon
              className={cn('size-4 shrink-0', !mobile && 'hidden xl:inline-block')}
              aria-hidden="true"
            />
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  );

  if (!item.permission) return link;
  return <RequirePermission permission={item.permission}>{link}</RequirePermission>;
}

/**
 * Left-aligned primary nav, positioned immediately after the brand (not
 * centered across the header). Hidden below `lg`, where AppHeader instead
 * renders the same items in a collapsible panel; icons drop out between
 * `lg` and `xl` so the labels stay full-size and legible on tablet widths
 * instead of shrinking or overlapping the profile menu.
 *
 * The tinted `bg-nav-surface`/`border-nav-border` treatment (both derived
 * from --brand-navy, see index.css) is what makes this read as a distinct
 * "navigation region" against the header's white brand section, rather
 * than nav links floating directly on the same background — this is the
 * header's Option-A visual hierarchy: white brand, softly tinted nav,
 * separated profile.
 *
 * `min-w-0` lets this flex item shrink below its content's natural width
 * (the default `min-width: auto` on a flex item would otherwise force the
 * header wider than its container instead); `overflow-x-hidden` is a
 * last-resort backstop so that if a future role/nav-item combination still
 * doesn't fit at a given breakpoint, the excess clips inside the nav's own
 * box instead of spilling into the profile section's space — overlap is a
 * hard requirement here (AppHeader §"never overlaps"), a clipped item is
 * the acceptable fallback.
 */
export function PrimaryNavigation({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        'bg-nav-surface border-nav-border hidden min-w-0 items-center gap-0.5 overflow-x-hidden rounded-lg border px-1.5 py-1.5 lg:flex xl:gap-1',
        className,
      )}
    >
      {NAV_ITEMS.map((item) => (
        <NavLinkItem key={item.to} item={item} />
      ))}
    </nav>
  );
}
