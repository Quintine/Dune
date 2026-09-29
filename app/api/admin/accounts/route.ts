import { env } from 'cloudflare:workers';
import { AdminError, requireAdmin } from '@/db/admin-access';
import { applyAdminAccount, readAdminAccounts } from '@/db/admin-accounts';
import { adminBody, adminFailure, adminResponse, adminToken } from '@/lib/admin-http';
import { validAdminAccountInput } from '@/lib/admin-accounts';

export async function GET(request: Request) {
  try {
    const identity = await requireAdmin(env.DB, adminToken(request), ['owner']);
    const expected = request.headers.get('X-Dune-Admin-Id');
    if (expected && expected !== identity.id) throw new AdminError('The signed-in administrator changed. Reload accounts.', 401);
    return adminResponse(await readAdminAccounts(env.DB, identity, new URL(request.url).searchParams));
  } catch (error) { return adminFailure(error); }
}

export async function POST(request: Request) {
  try {
    const body = await adminBody(request, env.DUNE_PUBLIC_ORIGIN);
    const identity = await requireAdmin(env.DB, adminToken(request), ['owner']);
    if (request.headers.get('X-Dune-Admin-Id') !== identity.id)
      throw new AdminError('The signed-in administrator changed. Reload accounts.', 401);
    if (!validAdminAccountInput(body)) throw new AdminError('Check the account details, operation identifier and operational reason.', 400);
    return adminResponse(await applyAdminAccount(env.DB, identity, body));
  } catch (error) { return adminFailure(error); }
}
