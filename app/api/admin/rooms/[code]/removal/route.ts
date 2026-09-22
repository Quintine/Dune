import { env, waitUntil } from 'cloudflare:workers';
import { AdminError, requireAdmin } from '@/db/admin-access';
import { applyAdminRemoval, readAdminRemoval } from '@/db/admin-removal';
import { resumeRoom } from '@/db/room-continuation';
import { validAdminRemovalInput } from '@/lib/admin-removal';
import { adminBody, adminFailure, adminResponse, adminToken } from '@/lib/admin-http';

function code(request: Request) {
  const code = new URL(request.url).pathname.split('/').at(-2)?.toUpperCase() ?? '';
  if (code.length !== 8 || !/^[A-Z2-9]{8}$/.test(code)) throw new AdminError('Enter the eight-character room code.', 400);
  return code;
}

export async function GET(request: Request) {
  try {
    const identity = await requireAdmin(env.DB, adminToken(request));
    if (request.headers.has('X-Dune-Admin-Id') && request.headers.get('X-Dune-Admin-Id') !== identity.id)
      throw new AdminError('The signed-in administrator changed. Reload administration before continuing.', 401);
    return adminResponse(await readAdminRemoval(env.DB, identity, code(request)));
  } catch (error) { return adminFailure(error); }
}

export async function POST(request: Request) {
  try {
    const input = await adminBody(request, env.DUNE_PUBLIC_ORIGIN);
    const identity = await requireAdmin(env.DB, adminToken(request), ['owner', 'operator']);
    if (request.headers.get('X-Dune-Admin-Id') !== identity.id)
      throw new AdminError('The signed-in administrator changed. Reload administration before continuing.', 401);
    if (!validAdminRemovalInput(input)) throw new AdminError('Choose removal or restoration, current versions and an operational reason.', 400);
    const room = code(request);
    const result = await applyAdminRemoval(env.DB, identity, room, input);
    if (!result.replayed && !result.room.removed && !result.room.paused && !result.room.closed) waitUntil(resumeRoom(room));
    return adminResponse(result);
  } catch (error) { return adminFailure(error); }
}
