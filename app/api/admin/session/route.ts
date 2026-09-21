import { env } from 'cloudflare:workers';
import { AdminError, adminLogin, adminLogout, adminLogoutAll, requireAdmin } from '@/db/admin-access';
import { adminBody, adminCookie, adminFailure, adminResponse, adminToken } from '@/lib/admin-http';

export async function GET(request: Request) {
  try {
    const { id, name, role } = await requireAdmin(env.DB, adminToken(request));
    return adminResponse({ admin: { id, name, role } });
  } catch (error) { return adminFailure(error); }
}
export async function POST(request: Request) {
  try {
    const body = await adminBody(request, env.DUNE_PUBLIC_ORIGIN);
    if (body.action === 'login' && Object.keys(body).every(k => ['action', 'key'].includes(k))) {
      const result = await adminLogin(env.DB, body.key);
      return adminResponse({ admin: result.admin }, { 'Set-Cookie': adminCookie(request, result.token, env.DUNE_PUBLIC_ORIGIN) });
    }
    if (Object.keys(body).length !== 1) throw new AdminError('Invalid session action.', 400);
    if (body.action === 'logout') await adminLogout(env.DB, adminToken(request));
    else if (body.action === 'logoutAll') await adminLogoutAll(env.DB, await requireAdmin(env.DB, adminToken(request)));
    else throw new AdminError('Choose a valid session action.', 400);
    return adminResponse({ signedOut: true }, { 'Set-Cookie': adminCookie(request, '', env.DUNE_PUBLIC_ORIGIN) });
  } catch (error) { return adminFailure(error); }
}
