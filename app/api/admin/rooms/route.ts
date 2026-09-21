import { env } from 'cloudflare:workers';
import { requireAdmin } from '@/db/admin-access';
import { readAdminDirectory } from '@/db/admin-directory';
import { adminFailure, adminResponse, adminToken } from '@/lib/admin-http';

export async function GET(request: Request) {
  try {
    const identity = await requireAdmin(env.DB, adminToken(request), ['owner', 'operator', 'viewer']);
    return adminResponse(await readAdminDirectory(env.DB, identity, new URL(request.url).searchParams));
  } catch (error) { return adminFailure(error); }
}
