import {
  type ApiErrorResponse,
  apiErrorResponseSchema,
  type HealthCheckResponse,
  healthCheckResponseSchema,
  refreshResponseSchema,
} from '@hub-lanka/shared';
import { useAuthStore } from './authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1';

// /healthz is deliberately outside /api/v1 (ARCHITECTURE §23) so uptime
// monitors and load balancer probes can hit a stable, unversioned path.
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  const accessToken = useAuthStore.getState().accessToken;
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      // A FormData body (multipart receipt upload) needs fetch to set its
      // own Content-Type with the multipart boundary — never fix it here.
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
}

async function parseErrorAndThrow(response: Response): Promise<never> {
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = apiErrorResponseSchema.safeParse(body);
  const error: ApiErrorResponse['error'] = parsed.success
    ? parsed.data.error
    : { code: 'UNKNOWN_ERROR', message: response.statusText };

  throw new ApiClientError(error.message, error.code, response.status, error.details);
}

let refreshInFlight: Promise<boolean> | null = null;

/** POST /auth/refresh using the httpOnly cookie; updates the store on success. */
async function attemptRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!response.ok) return false;

        const body: unknown = await response.json();
        const parsed = refreshResponseSchema.safeParse(body);
        if (!parsed.success) return false;

        // The refresh response has no `user` — just rotate the token.
        // Whatever request triggered this refresh (including a first-load
        // GET /me bootstrap with no user yet) retries next with a valid
        // token and populates `user` itself if that's what it fetches.
        useAuthStore.getState().setAccessToken(parsed.data.accessToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

/**
 * Thin fetch wrapper for the versioned REST API. Money and other financial
 * values must stay as decimal strings all the way through this layer
 * (ARCHITECTURE §3) — never coerced to `number` here or by a caller.
 *
 * Attaches the in-memory access token; on a 401 it attempts exactly one
 * silent refresh (cookie-authenticated) and retries the request once. A
 * second failure clears the session so ProtectedRoute redirects to /login.
 */
export async function apiFetch<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  const response = await rawFetch(path, init ?? {});

  const isAuthEndpoint = path.startsWith('/auth/login') || path.startsWith('/auth/refresh');
  if (response.status === 401 && !isRetry && !isAuthEndpoint) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      return apiFetch<T>(path, init, true);
    }
    useAuthStore.getState().clearSession();
  }

  if (!response.ok) {
    await parseErrorAndThrow(response);
  }

  return response.json() as Promise<T>;
}

export async function fetchHealth(): Promise<HealthCheckResponse> {
  const response = await fetch(`${API_ORIGIN}/healthz`);
  const body: unknown = await response.json();
  return healthCheckResponseSchema.parse(body);
}
