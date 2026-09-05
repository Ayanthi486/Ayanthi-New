import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/lib/authStore';
import { ProfilePage } from './ProfilePage';

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

const baseUser = {
  id: 'u1',
  email: 'ashmika.dilshan@hublanka.dev',
  fullName: 'Ashmika Dilshan',
  roles: ['Manager'],
  permissions: ['identity.user.manage'],
  hasAvatar: false,
};

function renderProfilePage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfilePage />
    </QueryClientProvider>,
  );
}

function setUser(user: typeof baseUser) {
  useAuthStore.setState({
    user,
    permissions: new Set(user.permissions),
    accessToken: 'token',
    isLoading: false,
  });
}

describe('ProfilePage', () => {
  beforeEach(() => {
    setUser(baseUser);
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.setState({
      user: null,
      permissions: new Set(),
      accessToken: null,
      isLoading: false,
    });
  });

  it('renders the actual authenticated user’s full name, email, and role — not hardcoded values', () => {
    renderProfilePage();

    expect(screen.getByLabelText('Full name')).toHaveValue('Ashmika Dilshan');
    expect(screen.getByLabelText('Email')).toHaveValue('ashmika.dilshan@hublanka.dev');
    expect(screen.getByLabelText('Role')).toHaveValue('Manager');
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Role')).toBeDisabled();
  });

  it('shows initials (not a dev-seed-specific fallback) when there is no photo', () => {
    renderProfilePage();
    expect(screen.getByText('AD')).toBeInTheDocument();
  });

  it('shows Save/Cancel only once the name is edited, and Cancel restores the original value', () => {
    renderProfilePage();

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'New Name' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Full name')).toHaveValue('Ashmika Dilshan');
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('saves the new full name via PATCH /me and updates the session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith('/me') && init?.method === 'PATCH') {
          return Promise.resolve(jsonResponse(200, { ...baseUser, fullName: 'Ashmika D. Silva' }));
        }
        return Promise.resolve(jsonResponse(200, {}));
      }),
    );
    renderProfilePage();

    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'Ashmika D. Silva' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(useAuthStore.getState().user?.fullName).toBe('Ashmika D. Silva');
    });
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('rejects a non-image file client-side without calling the server', () => {
    vi.stubGlobal('fetch', vi.fn());
    renderProfilePage();

    const file = new File(['not-an-image'], 'resume.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Upload profile photo'), { target: { files: [file] } });

    expect(screen.getByText('Please choose a JPEG or PNG image.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects an oversized image client-side without calling the server', () => {
    vi.stubGlobal('fetch', vi.fn());
    renderProfilePage();

    const oversized = new File([new Uint8Array(4 * 1024 * 1024)], 'big.png', {
      type: 'image/png',
    });
    fireEvent.change(screen.getByLabelText('Upload profile photo'), {
      target: { files: [oversized] },
    });

    expect(screen.getByText('Image must be 3MB or smaller.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uploads a valid photo and then offers Remove', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith('/me/avatar') && init?.method === 'POST') {
          return Promise.resolve(jsonResponse(200, { ...baseUser, hasAvatar: true }));
        }
        if (url.endsWith('/me/avatar')) {
          return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob()) });
        }
        return Promise.resolve(jsonResponse(200, {}));
      }),
    );
    renderProfilePage();

    const file = new File(['fake-bytes'], 'photo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Upload profile photo'), { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });
  });

  it('removes the photo via DELETE /me/avatar', async () => {
    setUser({ ...baseUser, hasAvatar: true });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith('/me/avatar') && init?.method === 'DELETE') {
          return Promise.resolve(jsonResponse(200, { ...baseUser, hasAvatar: false }));
        }
        if (url.endsWith('/me/avatar')) {
          return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob()) });
        }
        return Promise.resolve(jsonResponse(200, {}));
      }),
    );
    renderProfilePage();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    });
    expect(useAuthStore.getState().user?.hasAvatar).toBe(false);
  });

  it('shows the server error message when the upload is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(422, {
            error: {
              code: 'BUSINESS_RULE_VIOLATION',
              message: 'Profile photo must be a JPEG or PNG image',
            },
          }),
        ),
      ),
    );
    renderProfilePage();

    const file = new File(['fake-bytes'], 'photo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Upload profile photo'), { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Profile photo must be a JPEG or PNG image')).toBeInTheDocument();
    });
  });
});
