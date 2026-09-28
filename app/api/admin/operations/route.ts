import { env } from 'cloudflare:workers';
import { AdminError, requireAdmin } from '@/db/admin-access';
import { readAdminOperations } from '@/db/admin-operations';
import { adminFailure, adminResponse, adminToken } from '@/lib/admin-http';
import { buildRevision } from '@/lib/build-revision';

export async function GET(request: Request) {
  try {
    const identity = await requireAdmin(env.DB, adminToken(request), ['owner']);
    const expected = request.headers.get('X-Dune-Admin-Id');
    if (expected && expected !== identity.id)
      throw new AdminError('The signed-in administrator changed. Reload operations.', 401);
    const counts = await readAdminOperations(env.DB, identity);
    return adminResponse({ revision: buildRevision, ...counts });
  } catch (error) { return adminFailure(error); }
}
