import assert from 'node:assert/strict';
import test from 'node:test';
import { adminLogin, requireAdmin, AdminError } from '../db/admin-access';
import { ADMIN_ATTEMPT_LIMIT, readAdminAttempts } from '../db/admin-attempts';
import { adminStore } from './admin-access-fixture';

const now = 10_000;
const owner = async () => {
  const store = adminStore();
  const account = store.provision('owner');
  const login = await adminLogin(store.database, account.key, now);
  const identity = await requireAdmin(store.database, login.token, ['owner'], now);
  return { store, account, login, identity };
};
const reasons = (page: Awaited<ReturnType<typeof readAdminAttempts>>) =>
  page.recent.map((row) => row.reason);
const rejects = async (promise: Promise<unknown>, status: number) =>
  await assert.rejects(
    promise,
    (error: unknown) => error instanceof AdminError && error.status === status,
  );

void test('rejected administrator requests are recorded by reason without storing any credential', async () => {
  const { store, account, login, identity } = await owner();
  try {
    await rejects(adminLogin(store.database, 42, now), 401);
    await rejects(adminLogin(store.database, 'not-a-key', now), 401);
    await rejects(
      adminLogin(store.database, `dune-admin.${account.id}.${'a'.repeat(64)}`, now),
      401,
    );
    await rejects(requireAdmin(store.database, 'short', ['owner'], now), 401);
    await rejects(requireAdmin(store.database, 'b'.repeat(64), ['owner'], now), 401);
    const spare = store.provision('owner', 'Disabled owner');
    store.sqlite.prepare('UPDATE admin_accounts SET enabled=0 WHERE id=?').run(spare.id);
    await rejects(adminLogin(store.database, spare.key, now), 401);
    const viewer = store.provision('viewer');
    const viewerLogin = await adminLogin(store.database, viewer.key, now);
    await rejects(requireAdmin(store.database, viewerLogin.token, ['owner'], now), 403);
    const page = await readAdminAttempts(store.database, identity, now);
    assert.equal(page.observedAt, now);
    assert.equal(page.windowMs, 7 * 24 * 60 * 60 * 1000);
    assert.equal(page.total, 7);
    assert.deepEqual(page.byReason, [
      { reason: 'invalid_key_format', count: 2 },
      { reason: 'missing_session', count: 1 },
      { reason: 'role_denied', count: 1 },
      { reason: 'unknown_or_disabled_key', count: 2 },
      { reason: 'unknown_or_expired_session', count: 1 },
    ]);
    assert.deepEqual(reasons(page), [
      'role_denied',
      'unknown_or_disabled_key',
      'unknown_or_expired_session',
      'missing_session',
      'unknown_or_disabled_key',
      'invalid_key_format',
      'invalid_key_format',
    ]);
    const denial = page.recent[0];
    assert.equal(denial.kind, 'role');
    assert.equal(denial.role, 'viewer');
    assert.equal(denial.accountId, viewer.id);
    assert.equal(denial.createdAt, now);
    const serialized = JSON.stringify(page);
    for (const secret of [account.key, viewer.key, login.token, viewerLogin.token, 'dune-admin'])
      assert.equal(serialized.includes(secret), false, 'attempts never store a credential');
    // A successful login and privileged read record nothing further.
    await adminLogin(store.database, viewer.key, now);
    await requireAdmin(store.database, viewerLogin.token, undefined, now);
    assert.equal((await readAdminAttempts(store.database, identity, now)).total, 7);
  } finally { store.sqlite.close(); }
});

void test('attempt reading stays owner-only, bounded and best-effort when recording fails', async () => {
  const { store, identity } = await owner();
  try {
    for (let index = 0; index < ADMIN_ATTEMPT_LIMIT + 5; index++)
      await rejects(adminLogin(store.database, `bad-${index}`, now), 401);
    const page = await readAdminAttempts(store.database, identity, now);
    assert.equal(page.total, ADMIN_ATTEMPT_LIMIT + 5);
    assert.equal(page.recent.length, ADMIN_ATTEMPT_LIMIT);
    assert.equal(page.recent[0].createdAt, now);
    // Only the reporting window's counters are returned.
    store.sqlite
      .prepare('UPDATE admin_attempts SET created_at=?')
      .run(now - 8 * 24 * 60 * 60 * 1000);
    assert.equal((await readAdminAttempts(store.database, identity, now)).total, 0);
    store.provision('owner', 'Remaining owner');
    store.sqlite.prepare("UPDATE admin_accounts SET role='operator' WHERE id=?").run(identity.id);
    await rejects(readAdminAttempts(store.database, identity, now), 403);
  } finally { store.sqlite.close(); }
});

void test('a missing attempts table never changes the rejected request answer', async () => {
  const { store } = await owner();
  try {
    store.sqlite.exec('DROP TABLE admin_attempts');
    await rejects(adminLogin(store.database, 'not-a-key', now), 401);
    await rejects(requireAdmin(store.database, 'short', undefined, now), 401);
  } finally { store.sqlite.close(); }
});
