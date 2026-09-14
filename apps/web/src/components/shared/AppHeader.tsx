import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '@/components/shared/BrandMark';
import { NavLinkItem, NAV_ITEMS, PrimaryNavigation } from '@/components/shared/PrimaryNavigation';
import { ProfileMenu } from '@/components/shared/ProfileMenu';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';
import { logout } from '@/features/auth/api/authApi';
import { useAuthStore } from '@/lib/authStore';

/**
 * The single header used across every authenticated screen (rendered once
 * by AppLayout — see ARCHITECTURE §3). Three genuine flex siblings, not two
 * nested groups — this is deliberate: it's what makes the "profile can
 * never overlap navigation" guarantee structural rather than incidental.
 *
 *   AppHeader
 *   ├── Brand              (shrink-0 — fixed to its natural content width)
 *   ├── PrimaryNavigation  (flex-1 min-w-0 — claims whatever space is left
 *   │                       over after Brand and Profile take theirs, and
 *   │                       is the only section allowed to shrink/clip)
 *   └── ProfileMenu        (shrink-0 — always its natural width, always
 *                            the last item, so it's always at the far right)
 *
 * Unlike the page content below it, this row has no `max-w-*` cap: with a
 * fixed max-width, a wide viewport still only hands the flex row that
 * fixed budget, so a role with many nav items (e.g. Manager's full 8-item
 * set) could overflow it on *any* screen, wide or narrow, and — because
 * nav links are `whitespace-nowrap` and can't compress — that overflow
 * bleeds rightward into the profile section instead of shrinking. Letting
 * the row use the real viewport width fixes that at its source, and the
 * flex-1/min-w-0/shrink-0 split above is the backstop for the rare case
 * where it still doesn't fit.
 *
 * Below `lg` the primary nav collapses into a toggled panel instead of
 * competing with the profile menu for space; ProfileMenu itself stays
 * visible and unchanged at every width since it's already compact.
 *
 * Color hierarchy (all derived from --brand-navy, see index.css): Brand
 * stays on the plain white header background — the strongest identity
 * element; PrimaryNavigation sits on a light navy-tinted surface with its
 * own border, reading as a distinct navigation region; ProfileMenu gets a
 * matching but separately-scoped tinted pill so it never blends into the
 * nav. The header's bottom border also picks up a faint navy tint instead
 * of plain gray, tying the whole row together.
 */
export function AppHeader() {
  const user = useAuthStore((state) => state.user);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    void logout().finally(() => clearSession());
  };

  return (
    <header className="bg-background/80 backdrop-blur-md border-b-nav-border sticky top-0 z-40 border-b shadow-sm print:hidden transition-all duration-300">
      <div className="flex h-[72px] w-full items-center gap-4 px-6">
        <Link
          to="/"
          aria-label="Hub Lanka — Freight Forwarding Management System home"
          className="shrink-0"
        >
          <BrandMark size="sm" />
        </Link>

        {user && <PrimaryNavigation className="flex-1" />}

        {/* ml-auto still matters below `lg`: PrimaryNavigation is `hidden`
            (display:none) there, so its flex-1 contributes nothing to the
            row's layout and can't do the pushing-right on its own. */}
        {user && (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </Button>

            <ThemeToggle />

            <ProfileMenu
              fullName={user.fullName}
              email={user.email}
              roles={user.roles}
              hasAvatar={user.hasAvatar}
              showSystemStatus={hasPermission('identity.user.manage')}
              onSignOut={handleLogout}
            />
          </div>
        )}
      </div>

      <AnimatePresence>
        {user && mobileOpen && (
          <motion.div
            id="mobile-nav"
            className="border-border border-t lg:hidden overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <nav aria-label="Primary" className="flex flex-col gap-1 px-4 py-3">
              {NAV_ITEMS.map((item) => (
                <NavLinkItem
                  key={item.to}
                  item={item}
                  mobile
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
