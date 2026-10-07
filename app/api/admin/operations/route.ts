import { env } from 'cloudflare:workers';
import { AdminError, requireAdmin } from '@/db/admin-access';
import { ADMIN_STALL_MS, readAdminIntegrity, readAdminOperations, readAdminStalledDecisions } from '@/db/admin-operations';
import { adminFailure, adminResponse, adminToken } from '@/lib/admin-http';
import { buildRevision } from '@/lib/build-revision';

export async function GET(request: Request) {
  try {
    const identity = await requireAdmin(env.DB, adminToken(request), ['owner']);
    const expected = request.headers.get('X-Dune-Admin-Id');
    if (expected && expected !== identity.id)
      throw new AdminError('The signed-in administrator changed. Reload operations.', 401);
    const query = new URL(request.url).searchParams;
    const reads = ['integrity', 'stalled'];
    if (query.size && (query.size !== 1 || !reads.some(read => query.get(read) === '1')))
      throw new AdminError('Invalid operations request.', 400);
    if (query.get('integrity') === '1')
      return adminResponse(await readAdminIntegrity(env.DB, identity));
    if (query.get('stalled') === '1')
      return adminResponse({ revision: buildRevision, observedAt: Date.now(),
        stallMs: ADMIN_STALL_MS, stalled: await readAdminStalledDecisions(env.DB, identity) });
    return adminResponse({ revision: buildRevision, ...await readAdminOperations(env.DB, identity) });
  } catch (error) { return adminFailure(error); }
}
