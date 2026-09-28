import { env } from 'cloudflare:workers';
import { AdminError, requireAdmin } from '@/db/admin-access';
import { captureAdminBackup, listAdminBackups, validBackupInput } from '@/db/admin-backups';
import { adminBody, adminFailure, adminResponse, adminToken } from '@/lib/admin-http';

function matchIdentity(request: Request, id: string, mutation: boolean) {
  const header = request.headers.get('X-Dune-Admin-Id');
  if ((mutation || header !== null) && header !== id)
    throw new AdminError('The signed-in administrator changed. Reload administration before continuing.', 401);
}

export async function GET(request: Request) {
  try {
    const identity = await requireAdmin(env.DB, adminToken(request), ['owner']);
    matchIdentity(request, identity.id, false);
    const search = new URL(request.url).searchParams;
    if ([...search.keys()].some(key => key !== 'room') || search.getAll('room').length !== 1)
      throw new AdminError('Enter exactly one room code.', 400);
    return adminResponse({ backups: await listAdminBackups(env.DB, identity, search.get('room') ?? '') });
  } catch (error) { return adminFailure(error); }
}

export async function POST(request: Request) {
  try {
    const input = await adminBody(request, env.DUNE_PUBLIC_ORIGIN);
    const identity = await requireAdmin(env.DB, adminToken(request), ['owner']);
    matchIdentity(request, identity.id, true);
    if (!validBackupInput(input)) throw new AdminError('Provide a room, current version, operation identifier and operational reason.', 400);
    return adminResponse(await captureAdminBackup(env.DB, identity, input));
  } catch (error) { return adminFailure(error); }
}
