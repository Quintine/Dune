import { env } from 'cloudflare:workers';
import { AdminError, requireAdmin } from '@/db/admin-access';
import { applyAdminSeatAi, readAdminSeatAi } from '@/db/admin-seat-ai';
import { validAdminSeatAiInput } from '@/lib/admin-seat-ai';
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
    return adminResponse(await readAdminSeatAi(env.DB, identity, code(request)));
  } catch (error) { return adminFailure(error); }
}

export async function POST(request: Request) {
  try {
    const input = await adminBody(request, env.DUNE_PUBLIC_ORIGIN);
    const identity = await requireAdmin(env.DB, adminToken(request), ['owner', 'operator']);
    if (request.headers.get('X-Dune-Admin-Id') !== identity.id)
      throw new AdminError('The signed-in administrator changed. Reload administration before continuing.', 401);
    if (!validAdminSeatAiInput(input)) throw new AdminError('Choose a participant, difficulty, current versions and an operational reason.', 400);
    const room = code(request);
    const result = await applyAdminSeatAi(env.DB, identity, room, input);
    return adminResponse(result);
  } catch (error) { return adminFailure(error); }
}
