export type AdminRole = 'owner' | 'operator' | 'viewer';
export type AdminAccount = { id: string; name: string; role: AdminRole };
export type AdminIdentity = AdminAccount & { sessionHash: string };

export const ADMIN_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

const UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const KEY_PATTERN = new RegExp(`^dune-admin\\.(${UUID})\\.[0-9a-f]{64}$`);
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export class AdminError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AdminError';
  }
}

function isRole(value: string): value is AdminRole {
  return value === 'owner' || value === 'operator' || value === 'viewer';
}

async function hash(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function sessionToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

const signInRequired = () =>
  new AdminError('Administrator sign-in required.', 401);

/** Creates an independent admin session. Access keys and session tokens never enter audit records. */
export async function adminLogin(
  database: D1Database,
  key: unknown,
  now = Date.now(),
): Promise<{
  token: string;
  admin: AdminAccount;
  expiresAt: number;
}> {
  const invalid = () =>
    new AdminError('Administrator access key is invalid or revoked.', 401);
  if (typeof key !== 'string') throw invalid();
  const match = KEY_PATTERN.exec(key);
  if (!match || match[0] !== key) throw invalid();
  const keyHash = await hash(key);
  const account = await database
    .prepare(
      'SELECT id,name,role,session_generation FROM admin_accounts WHERE id = ? AND key_hash = ? AND enabled = 1',
    )
    .bind(match[1], keyHash)
    .first<AdminAccount & { session_generation: number }>();
  if (!account || !isRole(account.role)) throw invalid();

  const token = sessionToken();
  const tokenHash = await hash(token);
  const sessionId = crypto.randomUUID();
  const expiresAt = now + ADMIN_SESSION_DURATION_MS;
  // Repeat the credential and generation fence at the write. A disable or
  // logout-all between the read and this batch cannot resurrect an old session.
  const results = await database.batch([
    database
      .prepare(
        `INSERT INTO admin_sessions (token_hash,id,admin_id,generation,created_at,expires_at)
       SELECT ?,?,id,session_generation,?,? FROM admin_accounts
       WHERE id = ? AND key_hash = ? AND enabled = 1 AND session_generation = ?`,
      )
      .bind(
        tokenHash,
        sessionId,
        now,
        expiresAt,
        account.id,
        keyHash,
        account.session_generation,
      ),
    database
      .prepare(
        `INSERT INTO admin_audit (id,actor_admin_id,target_admin_id,action,created_at,detail)
       SELECT ?,admin_id,admin_id,'login',?,? FROM admin_sessions WHERE token_hash = ?`,
      )
      .bind(crypto.randomUUID(), now, JSON.stringify({ sessionId }), tokenHash),
  ]);
  if (results[0].meta.changes !== 1) throw invalid();
  // Return current role/name, and fail if revocation committed after creation.
  const { id, name, role } = await requireAdmin(
    database,
    token,
    undefined,
    now,
  );
  return { token, admin: { id, name, role }, expiresAt };
}

/** Every privileged request checks live account status, role, generation and absolute expiry. */
export async function requireAdmin(
  database: D1Database,
  token: string | undefined,
  roles?: AdminRole[],
  now = Date.now(),
): Promise<AdminIdentity> {
  if (
    typeof token !== 'string' ||
    token.length !== 64 ||
    !TOKEN_PATTERN.test(token)
  )
    throw signInRequired();
  const sessionHash = await hash(token);
  const account = await database
    .prepare(
      `SELECT a.id,a.name,a.role FROM admin_accounts a
     JOIN admin_sessions s ON s.admin_id = a.id
     WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
       AND s.generation = a.session_generation AND a.enabled = 1`,
    )
    .bind(sessionHash, now)
    .first<AdminAccount>();
  if (!account || !isRole(account.role)) throw signInRequired();
  if (roles && !roles.includes(account.role))
    throw new AdminError(
      'Your administrator role does not permit this action.',
      403,
    );
  return {
    id: account.id,
    name: account.name,
    role: account.role,
    sessionHash,
  };
}

/** Idempotent browser logout also accepts an expired/disabled session, without granting any privilege. */
export async function adminLogout(
  database: D1Database,
  token: string | undefined,
  now = Date.now(),
): Promise<void> {
  if (
    typeof token !== 'string' ||
    token.length !== 64 ||
    !TOKEN_PATTERN.test(token)
  )
    return;
  const tokenHash = await hash(token);
  await database.batch([
    database
      .prepare(
        `INSERT INTO admin_audit (id,actor_admin_id,target_admin_id,action,created_at,detail)
       SELECT ?,admin_id,admin_id,'logout',?,json_object('sessionId',id)
       FROM admin_sessions WHERE token_hash = ? AND revoked_at IS NULL`,
      )
      .bind(crypto.randomUUID(), now, tokenHash),
    database
      .prepare(
        'UPDATE admin_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL',
      )
      .bind(now, tokenHash),
  ]);
}

/** Revoke every current browser session, including this one, while retaining the access key. */
export async function adminLogoutAll(
  database: D1Database,
  identity: AdminIdentity,
  now = Date.now(),
): Promise<void> {
  if (
    !identity ||
    typeof identity.sessionHash !== 'string' ||
    identity.sessionHash.length !== 64 ||
    !TOKEN_PATTERN.test(identity.sessionHash)
  )
    throw signInRequired();
  const auditId = crypto.randomUUID();
  const results = await database.batch([
    database
      .prepare(
        `UPDATE admin_accounts SET session_generation = session_generation + 1, updated_at = ?
       WHERE id = ? AND enabled = 1 AND EXISTS (
         SELECT 1 FROM admin_sessions s WHERE s.token_hash = ? AND s.admin_id = admin_accounts.id
         AND s.generation = admin_accounts.session_generation AND s.revoked_at IS NULL AND s.expires_at > ?
       )`,
      )
      .bind(now, identity.id, identity.sessionHash, now),
    // changes() refers to the account update immediately before this statement.
    database
      .prepare(
        `INSERT INTO admin_audit (id,actor_admin_id,target_admin_id,action,created_at)
       SELECT ?,id,id,'logout_all',? FROM admin_accounts WHERE id = ? AND changes() = 1`,
      )
      .bind(auditId, now, identity.id),
    database
      .prepare(
        `UPDATE admin_sessions SET revoked_at = ? WHERE admin_id = ? AND revoked_at IS NULL
       AND EXISTS (SELECT 1 FROM admin_audit WHERE id = ? AND action = 'logout_all')`,
      )
      .bind(now, identity.id, auditId),
  ]);
  if (results[0].meta.changes !== 1) throw signInRequired();
}
