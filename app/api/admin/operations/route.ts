import { env } from 'cloudflare:workers';
import { AdminError, requireAdmin } from '@/db/admin-access';
import { readAdminIntegrity, readAdminOperations } from '@/db/admin-operations';
import { adminFailure, adminResponse, adminToken } from '@/lib/admin-http';
import { buildRevision } from '@/lib/build-revision';

export async function GET(request: Request) {
  try {
    const identity = await requireAdmin(env.DB, adminToken(request), ['owner']);
    const expected = request.headers.get('X-Dune-Admin-Id');
    if (expected && expected !== identity.id)
      throw new AdminError('The signed-in administrator changed. Reload operations.', 401);
    const query = new URL(request.url).searchParams;
    if (query.size && (query.size !== 1 || query.get('integrity') !== '1'))
      throw new AdminError('Invalid operations request.', 400);
    if (query.has('integrity'))
      return adminResponse(await readAdminIntegrity(env.DB, identity));
    return adminResponse({ revision: buildRevision, ...await readAdminOperations(env.DB, identity) });
  } catch (error) { return adminFailure(error); }
}
