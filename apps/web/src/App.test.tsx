import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { useAuthStore } from '@/lib/authStore';

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

const meUser = {
  id: 'u1',
  email: 'exec@hublanka.dev',
  fullName: 'Test Executive',
  roles: ['Executive'],
  permissions: ['shipment.view'],
};

const managerUser = {
  id: 'u2',
  email: 'mgr@hublanka.dev',
  fullName: 'Test Manager',
  roles: ['Manager'],
  permissions: ['shipment.view', 'identity.user.manage'],
};

const emptyShipmentList = {
  data: [],
  meta: { page: 1, pageSize: 20, total: 0 },
  kpis: { total: 0, pending: 0, completed: 0, cancelled: 0 },
};

const emptyAnalyticsTotals = {
  key: 'total',
  label: 'Total',
  shipmentCount: 0,
  weightKg: '0.000',
  revenueUsd: '0.00',
  revenueLkr: '0.00',
  buyingCostUsd: '0.00',
  buyingCostLkr: '0.00',
  opexLkr: '0.00',
  profitLkr: '0.00',
};

/** Bootstraps a signed-in session for `user` and serves an empty schedule/cutoff/analytics feed. */
function stubAuthenticatedFetch(user: typeof meUser | typeof managerUser) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('/auth/refresh')) {
        return Promise.resolve(jsonResponse(200, { accessToken: 'token' }));
      }
      if (url.includes('/me')) {
        return Promise.resolve(jsonResponse(200, user));
      }
      if (url.includes('/shipments')) {
        return Promise.resolve(jsonResponse(200, emptyShipmentList));
      }
      if (url.includes('/cutoff/active')) {
        return Promise.resolve(jsonResponse(200, []));
      }
      if (url.includes('/analytics/summary')) {
        return Promise.resolve(
          jsonResponse(200, {
            groupBy: 'commodity',
            period: null,
            groups: [],
            totals: emptyAnalyticsTotals,
          }),
        );
      }
      return Promise.resolve(jsonResponse(200, {}));
    }),
  );
}

describe('App shell', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
    // Zustand's store is a module-level singleton — without this, a stale
    // session (or permission set) from one test leaks into the next test's
    // fresh <App/> mount before its own fetchMe() resolves.
    useAuthStore.setState({
      user: null,
      permissions: new Set(),
      accessToken: null,
      isLoading: true,
    });
  });

  it('redirects an unauthenticated visitor to the login page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(
            jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'no session' } }),
          );
        }
        if (url.includes('/me')) {
          return Promise.resolve(
            jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'no session' } }),
          );
        }
        return Promise.resolve(jsonResponse(200, {}));
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Hub Lanka' })).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('renders the authenticated shell once the session bootstraps via silent refresh', async () => {
    window.history.pushState({}, '', '/');
    let meCallCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(jsonResponse(200, { accessToken: 'new-token' }));
        }
        if (url.includes('/me')) {
          meCallCount += 1;
          // First call (no token yet) 401s; the retried call after the
          // silent refresh above succeeds — mirrors real apiClient behavior.
          if (meCallCount === 1) {
            return Promise.resolve(
              jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'no token' } }),
            );
          }
          return Promise.resolve(jsonResponse(200, meUser));
        }
        if (url.includes('/shipments')) {
          return Promise.resolve(jsonResponse(200, emptyShipmentList));
        }
        if (url.includes('/cutoff/active')) {
          return Promise.resolve(jsonResponse(200, []));
        }
        return Promise.resolve(jsonResponse(200, {}));
      }),
    );

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Open profile menu for Test Executive, Executive' }),
      ).toBeInTheDocument();
    });
    // "/" redirects to the Dashboard, which is its own overview page — NOT
    // the Daily Shipment Schedule (that's /shipments only; the whole point
    // of this fix is that the two are no longer the same page). The
    // redirect itself settles one render tick after the profile button
    // above appears, so this needs its own wait rather than a bare assert.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('heading', { name: 'Daily Shipment Schedule' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('System status')).not.toBeInTheDocument();
    // Executive does not hold identity.user.manage — the Users and System
    // Status nav links must not render (RequirePermission is presentation
    // only, but this still proves it reacts to the fetched permission set).
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('System Status')).not.toBeInTheDocument();
  });

  it('redirects a non-admin (Executive) away from /settings/system-status back to the Dashboard', async () => {
    window.history.pushState({}, '', '/settings/system-status');
    stubAuthenticatedFetch(meUser);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    });
    expect(screen.queryByText('System status')).not.toBeInTheDocument();
  });

  it('/dashboard and /shipments render different pages reading the same shipment data', async () => {
    stubAuthenticatedFetch(meUser);
    window.history.pushState({}, '', '/shipments');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Daily Shipment Schedule' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('lets a Manager (identity.user.manage) reach /settings/system-status', async () => {
    window.history.pushState({}, '', '/settings/system-status');
    stubAuthenticatedFetch(managerUser);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'System status' })).toBeInTheDocument();
    });
  });

  it('does not show System Status in the primary nav for any role, but the ProfileMenu offers it only to identity.user.manage holders', async () => {
    stubAuthenticatedFetch(managerUser);
    window.history.pushState({}, '', '/dashboard');

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Open profile menu for Test Manager, Manager' }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('navigation', { name: 'Primary' }).textContent).not.toMatch(
      /System Status/,
    );
  });
});
