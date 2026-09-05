import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Avatar, getInitials } from '@/components/shared/Avatar';
import { useAuthStore } from '@/lib/authStore';

function stubAvatarFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['fake-image-bytes'], { type: 'image/png' })),
    }),
  );
}

describe('getInitials', () => {
  it('derives initials from the user’s actual full name, not a dev-seed-specific fallback', () => {
    expect(getInitials('Ashmika Dilshan')).toBe('AD');
    expect(getInitials('Chamari Wickramasinghe')).toBe('CW');
    expect(getInitials('Madonna')).toBe('M');
  });
});

describe('Avatar', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
    useAuthStore.setState({ accessToken: 'token' });
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

  it('shows initials derived from fullName when no photo is set — no fetch attempted', () => {
    stubAvatarFetch();
    render(<Avatar fullName="Ashmika Dilshan" hasAvatar={false} />);

    expect(screen.getByText('AD')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches and renders the uploaded photo as an image when hasAvatar is true', async () => {
    stubAvatarFetch();
    render(<Avatar fullName="Ashmika Dilshan" hasAvatar />);

    await waitFor(() => {
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:mock-url');
    expect(screen.queryByText('AD')).not.toBeInTheDocument();
  });

  it('falls back to initials if the authenticated photo fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, blob: () => Promise.reject(new Error('no body')) }),
    );
    render(<Avatar fullName="Ashmika Dilshan" hasAvatar />);

    await waitFor(() => {
      expect(screen.getByText('AD')).toBeInTheDocument();
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
