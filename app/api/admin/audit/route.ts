import { env } from 'cloudflare:workers';
import { AdminError, requireAdmin } from '@/db/admin-access';
import { readAdminAudit } from '@/db/admin-audit';
import { adminFailure, adminResponse, adminToken } from '@/lib/admin-http';

export async function GET(request: Request) {
  try {
    const identity = await requireAdmin(env.DB,adminToken(request),['owner','operator','viewer']);
    const expected = request.headers.get('X-Dune-Admin-Id');
    if (expected && expected !== identity.id) throw new AdminError('The signed-in administrator changed. Reload action history.',401);
    return adminResponse(await readAdminAudit(env.DB,identity,new URL(request.url).searchParams));
  } catch (error) { return adminFailure(error); }
}
