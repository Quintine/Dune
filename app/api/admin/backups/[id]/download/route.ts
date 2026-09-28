import { env } from 'cloudflare:workers';
import { AdminError, requireAdmin } from '@/db/admin-access';
import { downloadAdminBackup } from '@/db/admin-backups';
import { adminFailure, adminToken } from '@/lib/admin-http';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireAdmin(env.DB, adminToken(request), ['owner']);
    const expected = request.headers.get('X-Dune-Admin-Id');
    if (expected !== null && expected !== identity.id)
      throw new AdminError('The signed-in administrator changed. Reload administration before continuing.', 401);
    const { id } = await context.params;
    const { backup, payload } = await downloadAdminBackup(env.DB, identity, id);
    return new Response(payload, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="dune-room-${backup.roomCode}-backup-${backup.id}.json"`,
        'Cache-Control': 'no-store',
        'Vary': 'Cookie',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) { return adminFailure(error); }
}
