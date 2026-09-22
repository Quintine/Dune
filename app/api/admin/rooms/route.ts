import { env } from 'cloudflare:workers';
import { AdminError, requireAdmin } from '@/db/admin-access';
import { readAdminDirectory } from '@/db/admin-directory';
import { createAdminRoom } from '@/db/admin-room-creation';
import { RuleError } from '@/game/engine';
import { adminBody, adminFailure, adminResponse, adminToken } from '@/lib/admin-http';
import { validAdminRoomCreationInput } from '@/lib/admin-room-creation';
import { requestOrigin } from '@/lib/request-origin';

export async function GET(request: Request) {
  try {
    const identity = await requireAdmin(env.DB, adminToken(request), ['owner', 'operator', 'viewer']);
    return adminResponse(await readAdminDirectory(env.DB, identity, new URL(request.url).searchParams));
  } catch (error) { return adminFailure(error); }
}

export async function POST(request: Request) {
  try {
    const body = await adminBody(request, env.DUNE_PUBLIC_ORIGIN);
    const identity = await requireAdmin(env.DB, adminToken(request), ['owner', 'operator']);
    if (request.headers.get('X-Dune-Admin-Id') !== identity.id)
      throw new AdminError('The signed-in administrator changed. Reload administration before continuing.', 401);
    if (!validAdminRoomCreationInput(body)) throw new AdminError('Check the host, rules, AI seats and operational reason.', 400);
    const result = await createAdminRoom(env.DB, identity, body);
    const headers: Record<string, string> = {};
    if (result.hostAccess) headers['Set-Cookie'] = `dune_${result.code}=${body.sessionToken}; HttpOnly; SameSite=Strict; Path=/api/rooms/${result.code}; Max-Age=2592000${requestOrigin(request, env.DUNE_PUBLIC_ORIGIN).startsWith('https:') ? '; Secure' : ''}`;
    return adminResponse(result, headers);
  } catch (error) { return adminFailure(error instanceof RuleError ? new AdminError(error.message, 400) : error); }
}
