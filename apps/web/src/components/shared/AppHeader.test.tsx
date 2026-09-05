import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppHeader } from '@/components/shared/AppHeader';
import { useAuthStore } from '@/lib/authStore';

vi.mock('@/features/auth/api/authApi', () => ({
  logout: vi.fn().mockResolvedValue(undefined),
}));

/** Radix's DropdownMenuTrigger opens on pointerdown, not click. */
function openProfileMenu(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerId: 1, pointerType: 'mouse' });
}

const baseUser = {
  id: 'u1',
  email: 'exec@hublanka.dev',
  fullName: 'Jane Perera',
  roles: ['Executive'],
  hasAvatar: false,
};

function setUser(permissions: string[]) {
  useAuthStore.setState({
    user: { ...baseUser, permissions },
    permissions: new Set(permissions),
    accessToken: 'token',
    isLoading: false,
  });
}

function renderHeader(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppHeader />
    </MemoryRouter>,
  );
}

const ALL_PERMISSIONS = [
  'shipment.view',
  'masterdata.manage',
  'masterdata.commodity.create',
  'rate.table.manage',
  'analytics.view',
  'identity.user.manage',
];

describe('AppHeader', () => {
  afterEach(() => {
    useAuthStore.setState({
      user: null,
      permissions: new Set(),
      accessToken: null,
      isLoading: false,
    });
  });

  it('renders no navigation or profile menu when signed out', () => {
    renderHeader();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open profile menu/ })).not.toBeInTheDocument();
    // The brand link is always visible.
    expect(screen.getByRole('link', { name: /Hub Lanka/ })).toBeInTheDocument();
  });

  it('shows only the nav items the user holds permission for', () => {
    setUser(['shipment.view', 'analytics.view']);
    renderHeader();

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: /Dashboard/ })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /Shipments/ })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /Analytics/ })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /Rate Table/ })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /Users/ })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /Master Data/ })).not.toBeInTheDocument();
  });

  it('renders every permission-gated item once the user holds every permission', () => {
    setUser(ALL_PERMISSIONS);
    renderHeader();

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    for (const name of [
      'Dashboard',
      'Shipments',
      'Master Data',
      'Commodities',
      'Rate Table',
      'Analytics',
      'Users',
    ]) {
      expect(within(nav).getByRole('link', { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it('never puts System Status in the primary nav, regardless of permissions', () => {
    setUser(ALL_PERMISSIONS);
    renderHeader();

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).queryByRole('link', { name: /System Status/ })).not.toBeInTheDocument();
  });

  it('marks the current route as the active nav item', () => {
    setUser(ALL_PERMISSIONS);
    renderHeader('/rates');

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: /Rate Table/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: /Dashboard/ })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('renders a profile menu trigger for the signed-in user (menu content covered by ProfileMenu.test.tsx)', () => {
    setUser(ALL_PERMISSIONS);
    renderHeader();

    expect(
      screen.getByRole('button', { name: 'Open profile menu for Jane Perera, Executive' }),
    ).toBeInTheDocument();
  });

  it('offers System Status from the profile menu only to identity.user.manage holders', () => {
    setUser(['shipment.view']);
    renderHeader();

    openProfileMenu(screen.getByRole('button', { name: /Open profile menu/ }));
    expect(screen.queryByRole('menuitem', { name: /System Status/ })).not.toBeInTheDocument();
  });

  it('shows System Status in the profile menu, linking to /settings/system-status, for identity.user.manage holders', () => {
    setUser(ALL_PERMISSIONS);
    renderHeader();

    openProfileMenu(screen.getByRole('button', { name: /Open profile menu/ }));
    const link = screen.getByRole('menuitem', { name: /System Status/ });
    expect(link).toHaveAttribute('href', '/settings/system-status');
  });

  it("lays out Brand/Nav/Profile as three independent flex siblings — nav flexible, profile fixed — so nav can never grow into profile's space", () => {
    setUser(ALL_PERMISSIONS);
    renderHeader();

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    // flex-1 + min-w-0: nav claims the leftover space and is the item
    // allowed to shrink, rather than pushing into a fixed-width sibling.
    expect(nav).toHaveClass('flex-1');
    expect(nav).toHaveClass('min-w-0');

    const profileButton = screen.getByRole('button', { name: /Open profile menu/ });
    const profileSection = profileButton.closest('div');
    expect(profileSection).toHaveClass('shrink-0');

    // Root-cause regression guard: the header row must not be capped to
    // the page-content max-width — a fixed cap reintroduces the overflow
    // regardless of how wide the actual viewport is.
    const headerRow = nav.parentElement;
    expect(headerRow).not.toHaveClass('max-w-5xl');
    expect(headerRow?.className).not.toMatch(/max-w-/);
  });

  it('keeps navigation before the profile section in DOM order, so profile always renders after (to the right of) nav', () => {
    setUser(ALL_PERMISSIONS);
    renderHeader();

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const profileButton = screen.getByRole('button', { name: /Open profile menu/ });
    expect(
      nav.compareDocumentPosition(profileButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('gates desktop nav and the mobile toggle to opposite sides of the `lg` breakpoint', () => {
    setUser(ALL_PERMISSIONS);
    renderHeader();

    // Desktop nav: hidden below `lg`, flex at `lg` and up.
    expect(screen.getByRole('navigation', { name: 'Primary' })).toHaveClass('hidden', 'lg:flex');
    // Mobile toggle: the mirror image — visible below `lg`, hidden at `lg`+.
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveClass('lg:hidden');
  });

  it('toggles the mobile menu open and closed, and closes it on navigation', () => {
    setUser(ALL_PERMISSIONS);
    renderHeader();

    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('mobile-nav')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const mobileNav = document.getElementById('mobile-nav');
    expect(mobileNav).toBeInTheDocument();

    fireEvent.click(within(mobileNav as HTMLElement).getByRole('link', { name: /Shipments/ }));
    expect(document.getElementById('mobile-nav')).not.toBeInTheDocument();
  });
});
