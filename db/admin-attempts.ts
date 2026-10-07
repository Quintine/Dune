import { AdminError } from './admin-error';
import type { AdminIdentity, AdminRole } from './admin-access';

/** Rejected authentication or authorization attempts, in durable, secret-free form. */
export type AdminAttemptKind = 'login' | 'session' | 'role';
export type AdminAttemptReason =
  | 'invalid_key_format'
  | 'unknown_or_disabled_key'
  | 'missing_session'
  | 'unknown_or_expired_session'
  | 'role_denied';

export type AdminAttempt = {
  createdAt: number;
  kind: AdminAttemptKind;
  reason: AdminAttemptReason;
  role: AdminRole | null;
  accountId: string | null;
};

export type AdminAttempts = {
  observedAt: number;
  windowMs: number;
  total: number;
  byReason: { reason: AdminAttemptReason; count: number }[];
  recent: AdminAttempt[];
};

/** Bounded owner sample; the page never lists every rejected request. */
export const ADMIN_ATTEMPT_LIMIT = 20;
/** Reporting window for the counters. */
export const ADMIN_ATTEMPT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const ownerAuthority = `SELECT a.role FROM admin_sessions s JOIN admin_accounts a ON a.id=s.admin_id
  WHERE s.token_hash=? AND a.id=? AND a.enabled=1 AND a.role='owner'
  AND s.revoked_at IS NULL AND s.expires_at>? AND s.generation=a.session_generation`;

/** Never stores a key, token, hash, request body or address: only the reason. */
export async function recordAdminAttempt(
  database: D1Database,
  attempt: {
    kind: AdminAttemptKind;
    reason: AdminAttemptReason;
    role?: AdminRole | null;
    accountId?: string | null;
  },
  now = Date.now(),
): Promise<void> {
  try {
    await database
      .prepare(
        `INSERT INTO admin_attempts (id,created_at,kind,reason,role,account_id)
         VALUES (?,?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        now,
        attempt.kind,
        attempt.reason,
        attempt.role ?? null,
        attempt.accountId ?? null,
      )
      .run();
  } catch {
    // Recording is best-effort: a rejected request must keep its own answer
    // even when the attempt table is unavailable.
  }
}

/** Owner-only, read-only counters and a bounded recent sample. */
export async function readAdminAttempts(
  database: D1Database,
  identity: AdminIdentity,
  now = Date.now(),
): Promise<AdminAttempts> {
  const since = now - ADMIN_ATTEMPT_WINDOW_MS;
  const authority = database.prepare(ownerAuthority).bind(identity.sessionHash, identity.id, now);
  const counters = database
    .prepare(
      `SELECT reason, COUNT(*) count FROM admin_attempts WHERE created_at>=?
       GROUP BY reason ORDER BY reason`,
    )
    .bind(since);
  const recent = database
    .prepare(
      `SELECT created_at createdAt, kind, reason, role, account_id accountId
       FROM admin_attempts ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(ADMIN_ATTEMPT_LIMIT);
  const [authorized, grouped, latest] = await database.batch([
    authority,
    counters,
    recent,
  ]);
  if (!authorized.results.length) throw new AdminError('Owner sign-in required.', 403);
  const byReason = (grouped.results as { reason: AdminAttemptReason; count: number }[])
    .map((row) => ({ reason: row.reason, count: row.count }));
  return {
    observedAt: now,
    windowMs: ADMIN_ATTEMPT_WINDOW_MS,
    total: byReason.reduce((sum, row) => sum + row.count, 0),
    byReason,
    recent: (latest.results as AdminAttempt[]).map((row) => ({
      createdAt: row.createdAt,
      kind: row.kind,
      reason: row.reason,
      role: row.role ?? null,
      accountId: row.accountId ?? null,
    })),
  };
}
