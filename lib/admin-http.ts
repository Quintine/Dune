import { requestOrigin } from './request-origin';
import { AdminError } from '../db/admin-access';

const cookieName = 'dune_admin_session';
export function adminToken(request: Request): string | undefined {
  return request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
}
export function adminCookie(request: Request, token: string, configuredOrigin?: string): string {
  const secure = new URL(requestOrigin(request, configuredOrigin)).protocol === 'https:';
  return `${cookieName}=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${token ? 28800 : 0}${secure ? '; Secure' : ''}`;
}
export async function adminBody(request: Request, configuredOrigin?: string): Promise<Record<string, unknown>> {
  // Require a browser's exact configured origin even for sign-in, preventing login CSRF.
  if (request.headers.get('origin') !== requestOrigin(request, configuredOrigin) ||
      request.headers.get('sec-fetch-site') === 'cross-site') throw new AdminError('Invalid request origin.', 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new AdminError('Send a JSON request.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AdminError('Enter the request details.', 400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) { void reader.cancel(); throw new AdminError('Request too large.', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AdminError('Invalid request.', 400);
  return data as Record<string, unknown>;
}
export function adminResponse(value: unknown, extra: HeadersInit = {}) {
  const headers = new Headers(extra);
  headers.set('Cache-Control', 'no-store');
  headers.set('Vary', 'Cookie');
  headers.set('X-Content-Type-Options', 'nosniff');
  return Response.json(value, { headers });
}
export function adminFailure(error: unknown) {
  const status = error instanceof AdminError ? error.status : error instanceof SyntaxError ? 400 : 503;
  return Response.json({ error: error instanceof AdminError ? error.message : error instanceof SyntaxError ? 'Invalid JSON.' : 'Administration is temporarily unavailable. Try again.' },
    { status, headers: { 'Cache-Control': 'no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff' } });
}
