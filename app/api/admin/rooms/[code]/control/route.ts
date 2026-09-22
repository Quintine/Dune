import { env, waitUntil } from 'cloudflare:workers';
import { AdminError, requireAdmin } from '@/db/admin-access';
import { applyAdminRoomControl, readAdminRoomControl } from '@/db/admin-lifecycle';
import { resumeRoom } from '@/db/room-continuation';
import { adminBody, adminFailure, adminResponse, adminToken } from '@/lib/admin-http';
import { validAdminRoomControlInput } from '@/lib/room-control';

function roomCode(request: Request) {
  const code = new URL(request.url).pathname.split('/').at(-2)?.toUpperCase() ?? '';
  if (!/^[A-Z2-9]{8}$/.test(code)) throw new AdminError('Enter the eight-character room code.', 400);
  return code;
}

export async function GET(request: Request) {
  try {
    const identity = await requireAdmin(env.DB, adminToken(request));
    if (request.headers.has('X-Dune-Admin-Id') && request.headers.get('X-Dune-Admin-Id') !== identity.id)
      throw new AdminError('The signed-in administrator changed. Reload administration before continuing.', 401);
    return adminResponse(await readAdminRoomControl(env.DB, identity, roomCode(request)));
  } catch (error) { return adminFailure(error); }
}

export async function POST(request: Request) {
  try {
    const body = await adminBody(request, env.DUNE_PUBLIC_ORIGIN);
    const identity = await requireAdmin(env.DB, adminToken(request), ['owner', 'operator']);
    if (request.headers.get('X-Dune-Admin-Id') !== identity.id)
      throw new AdminError('The signed-in administrator changed. Reload administration before continuing.', 401);
    if (!validAdminRoomControlInput(body)) throw new AdminError('Provide room settings and a reason of 1–300 characters.', 400);
    const code = roomCode(request);
    const result = await applyAdminRoomControl(env.DB, identity, code, body);
    if (!result.paused) waitUntil(resumeRoom(code));
    return adminResponse(result);
  } catch (error) { return adminFailure(error); }
}
