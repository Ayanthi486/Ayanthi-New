import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProfileMenu } from '@/components/shared/ProfileMenu';

/** Radix's DropdownMenuTrigger opens on pointerdown, not click. */
function openMenu(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerId: 1, pointerType: 'mouse' });
}

function renderMenu(onSignOut = vi.fn()) {
  render(
    <MemoryRouter>
      <ProfileMenu
        fullName="Dilan Mendis"
        email="dilan.mendis@hublanka.dev"
        roles={['Manager']}
        hasAvatar={false}
        onSignOut={onSignOut}
      />
    </MemoryRouter>,
  );
  return { onSignOut };
}

describe('ProfileMenu', () => {
  it('renders a compact trigger with an accessible name and initials avatar, menu closed by default', () => {
    renderMenu();

    const trigger = screen.getByRole('button', {
      name: 'Open profile menu for Dilan Mendis, Manager',
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveTextContent('DM');
    expect(screen.queryByText('dilan.mendis@hublanka.dev')).not.toBeInTheDocument();
  });

  it('shows the authenticated user name, role, and email on open — not hardcoded values', () => {
    render(
      <MemoryRouter>
        <ProfileMenu
          fullName="Nadeesha Silva"
          email="nadeesha@hublanka.dev"
          roles={['Director']}
          hasAvatar={false}
          onSignOut={vi.fn()}
        />
      </MemoryRouter>,
    );

    openMenu(screen.getByRole('button', { name: /Open profile menu/ }));

    expect(screen.getByText('Nadeesha Silva')).toBeInTheDocument();
    expect(screen.getByText('Director')).toBeInTheDocument();
    expect(screen.getByText('nadeesha@hublanka.dev')).toBeInTheDocument();
  });

  it('always offers a Profile link to /profile', () => {
    renderMenu();

    openMenu(screen.getByRole('button', { name: /Open profile menu/ }));
    const link = screen.getByRole('menuitem', { name: /Profile/ });
    expect(link).toHaveAttribute('href', '/profile');
  });

  it('calls onSignOut when the Sign out item is selected', () => {
    const { onSignOut } = renderMenu();

    openMenu(screen.getByRole('button', { name: /Open profile menu/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Sign out/ }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    renderMenu();

    openMenu(screen.getByRole('button', { name: /Open profile menu/ }));
    expect(screen.getByRole('menuitem', { name: /Sign out/ })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menuitem', { name: /Sign out/ })).not.toBeInTheDocument();
  });

  it('does not show System Status by default', () => {
    renderMenu();

    openMenu(screen.getByRole('button', { name: /Open profile menu/ }));
    expect(screen.queryByRole('menuitem', { name: /System Status/ })).not.toBeInTheDocument();
  });

  it('shows a System Status link to /settings/system-status when showSystemStatus is true', () => {
    render(
      <MemoryRouter>
        <ProfileMenu
          fullName="Dilan Mendis"
          email="dilan.mendis@hublanka.dev"
          roles={['Manager']}
          hasAvatar={false}
          showSystemStatus
          onSignOut={vi.fn()}
        />
      </MemoryRouter>,
    );

    openMenu(screen.getByRole('button', { name: /Open profile menu/ }));
    const link = screen.getByRole('menuitem', { name: /System Status/ });
    expect(link).toHaveAttribute('href', '/settings/system-status');
  });

  it('closes when clicking outside the menu', async () => {
    renderMenu();
    const outside = document.createElement('button');
    document.body.appendChild(outside);

    openMenu(screen.getByRole('button', { name: /Open profile menu/ }));
    expect(screen.getByRole('menuitem', { name: /Sign out/ })).toBeInTheDocument();

    // Radix's outside-pointerdown listener attaches via a 0ms `setTimeout`
    // (so the same pointerdown that opens the menu can't also close it) —
    // flush that before dispatching the "outside" event.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.pointerDown(outside);

    expect(screen.queryByRole('menuitem', { name: /Sign out/ })).not.toBeInTheDocument();

    outside.remove();
  });
});
