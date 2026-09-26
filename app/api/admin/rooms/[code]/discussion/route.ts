import { env } from 'cloudflare:workers';
import { AdminError, requireAdmin } from '@/db/admin-access';
import { applyAdminDiscussion, readAdminDiscussion } from '@/db/admin-discussion';
import { validAdminDiscussionInput } from '@/lib/admin-discussion';
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
    return adminResponse(await readAdminDiscussion(env.DB, identity, code(request)));
  } catch (error) { return adminFailure(error); }
}
export async function POST(request: Request) {
  try {
    const input = await adminBody(request, env.DUNE_PUBLIC_ORIGIN);
    const identity = await requireAdmin(env.DB, adminToken(request), ['owner','operator']);
    if (request.headers.get('X-Dune-Admin-Id') !== identity.id)
      throw new AdminError('The signed-in administrator changed. Reload administration before continuing.', 401);
    if (!validAdminDiscussionInput(input)) throw new AdminError('Choose a participant, discussion setting, current versions and a short reason.', 400);
    return adminResponse(await applyAdminDiscussion(env.DB, identity, code(request), input));
  } catch (error) { return adminFailure(error); }
}
