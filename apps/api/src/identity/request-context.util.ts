import type { Request } from 'express';

export function extractClientIp(req: Request): string | null {
  return req.ip ?? null;
}

export function extractUserAgent(req: Request): string | null {
  // Express's header index signature resolves to `any` in this project's
  // @types/express version rather than `string | string[] | undefined`;
  // asserting the documented Node http.IncomingHttpHeaders shape here is
  // safe — it's still checked defensively below.
  const value = req.headers['user-agent'] as string | string[] | undefined;
  if (Array.isArray(value)) {
    const first: string | undefined = value[0];
    return first ?? null;
  }
  return value ?? null;
}
