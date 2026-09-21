import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  ADMIN_SESSION_DURATION_MS,
  AdminError,
  adminLogin,
  adminLogout,
  adminLogoutAll,
  requireAdmin,
} from '../db/admin-access';
import { adminStore, pauseAdminBatch, sha256 } from './admin-access-fixture';

const denied =
  (status = 401) =>
  (error: unknown) =>
    error instanceof AdminError && error.status === status;
function snapshot(store: ReturnType<typeof adminStore>) {
  return JSON.stringify(
    ['admin_accounts', 'admin_sessions', 'admin_audit'].map((table) =>
      store.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
    ),
  );
}

void test('admin migration is additive and preserves preexisting room and seat bytes', () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
      .filter((file) => file.endsWith('.sql') && file < '0008')
      .sort())
      sqlite.exec(
        readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'),
      );
    sqlite
      .prepare(
        'INSERT INTO rooms (code,state,version,updated_at) VALUES (?,?,?,?)',
      )
      .run('PRIOR001', '{"private":"sealed","version":17}', 17, 9000);
    sqlite
      .prepare(
        'INSERT INTO seats (token_hash,revoked,room_code,player_id) VALUES (?,?,?,?)',
      )
      .run('c1'.repeat(32), 0, 'PRIOR001', 'saved-player');
    const before = JSON.stringify([
      sqlite.prepare('SELECT * FROM rooms').all(),
      sqlite.prepare('SELECT * FROM seats').all(),
    ]);
    sqlite.exec(
      readFileSync(
        new URL('../drizzle/0008_admin_access.sql', import.meta.url),
        'utf8',
      ),
    );
    assert.equal(
      JSON.stringify([
        sqlite.prepare('SELECT * FROM rooms').all(),
        sqlite.prepare('SELECT * FROM seats').all(),
      ]),
      before,
    );
    assert.equal(
      sqlite
        .prepare(
          "SELECT count(*) AS n FROM sqlite_master WHERE name = 'rooms_updated_at' AND type = 'index'",
        )
        .get()!.n,
      1,
    );
    assert.equal(
      sqlite.prepare('SELECT count(*) AS n FROM admin_accounts').get()!.n,
      0,
    );
  } finally {
    sqlite.close();
  }
});

void test('malformed credentials fail before querying D1, including a trailing line break', async () => {
  const database = {
    prepare: () => {
      throw new Error('Unexpected database query');
    },
  } as unknown as D1Database;
  const key = `dune-admin.10000000-0000-4000-8000-000000000001.${'a'.repeat(64)}`;
  for (const malformed of [`${key}\n`, `${key}\r\n`, ` ${key}`, {}, null])
    await assert.rejects(adminLogin(database, malformed, 1000), denied());
  for (const malformed of ['a'.repeat(64) + '\n', 'A'.repeat(64), undefined])
    await assert.rejects(
      requireAdmin(database, malformed, undefined, 1000),
      denied(),
    );
});

void test('admin login persists only hashes, preserves audit privacy and survives a database restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dune-admin-restart-'));
  const path = join(directory, 'admin.sqlite');
  let store = adminStore(path);
  try {
    assert.ok(store.sqlite instanceof DatabaseSync);
    const owner = store.provision();
    const login = await adminLogin(store.database, owner.key, 1000);
    assert.deepEqual(login.admin, {
      id: owner.id,
      name: owner.name,
      role: owner.role,
    });
    assert.equal(login.expiresAt, 1000 + ADMIN_SESSION_DURATION_MS);
    assert.match(login.token, /^[0-9a-f]{64}$/);
    const second = await adminLogin(store.database, owner.key, 2000);
    assert.notEqual(second.token, login.token);
    const saved = snapshot(store);
    assert.equal(saved.includes(owner.key), false);
    assert.equal(saved.includes(login.token), false);
    assert.equal(saved.includes(second.token), false);
    assert.ok(saved.includes(sha256(owner.key)));
    assert.ok(saved.includes(sha256(login.token)));
    const audit = JSON.stringify(
      store.sqlite.prepare('SELECT * FROM admin_audit').all(),
    );
    assert.equal(audit.includes(sha256(owner.key)), false);
    assert.equal(audit.includes(sha256(login.token)), false);
    assert.equal(audit.includes('sessionId'), true);
    store.sqlite.close();
    store = adminStore(path, false);
    assert.deepEqual(
      await requireAdmin(store.database, login.token, ['owner'], 3000),
      {
        ...login.admin,
        sessionHash: sha256(login.token),
      },
    );
  } finally {
    store.sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

void test('absolute expiry cannot be extended by authenticated reads', async () => {
  const store = adminStore();
  try {
    const owner = store.provision();
    const login = await adminLogin(store.database, owner.key, 5000);
    await requireAdmin(
      store.database,
      login.token,
      undefined,
      login.expiresAt - 1,
    );
    const before = snapshot(store);
    await assert.rejects(
      requireAdmin(store.database, login.token, undefined, login.expiresAt),
      denied(),
    );
    await assert.rejects(
      requireAdmin(store.database, login.token, undefined, login.expiresAt + 1),
      denied(),
    );
    assert.equal(snapshot(store), before);
  } finally {
    store.sqlite.close();
  }
});

void test('roles are checked against the current account and ordinary saved-seat cookies never grant admin access', async () => {
  const store = adminStore();
  try {
    const owner = store.provision();
    store.provision('owner', 'Other owner');
    const login = await adminLogin(store.database, owner.key, 1000);
    store.sqlite
      .prepare("UPDATE admin_accounts SET role = 'viewer' WHERE id = ?")
      .run(owner.id);
    assert.equal(
      (await requireAdmin(store.database, login.token, ['viewer'], 2000)).role,
      'viewer',
    );
    await assert.rejects(
      requireAdmin(store.database, login.token, ['owner', 'operator'], 2000),
      denied(403),
    );
    await assert.rejects(
      requireAdmin(store.database, login.token, [], 2000),
      denied(403),
    );
    const seatToken = 'ea'.repeat(32);
    store.sqlite
      .prepare('INSERT INTO rooms (code,state,updated_at) VALUES (?,?,?)')
      .run('ADMINQA1', '{"saved":"private"}', 1000);
    store.sqlite
      .prepare(
        'INSERT INTO seats (token_hash,room_code,player_id) VALUES (?,?,?)',
      )
      .run(sha256(seatToken), 'ADMINQA1', owner.id);
    const before = snapshot(store);
    await assert.rejects(
      requireAdmin(store.database, seatToken, undefined, 2000),
      denied(),
    );
    await assert.rejects(adminLogin(store.database, seatToken, 2000), denied());
    assert.equal(snapshot(store), before);
    assert.equal(
      store.sqlite.prepare('SELECT state FROM rooms').get()!.state,
      '{"saved":"private"}',
    );
  } finally {
    store.sqlite.close();
  }
});

void test('malformed and incorrect credentials are rejected without stored mutation or secret-bearing errors', async () => {
  const store = adminStore();
  try {
    const owner = store.provision();
    const before = snapshot(store);
    for (const key of [
      null,
      undefined,
      123,
      {},
      [],
      '',
      'shared-password',
      owner.key.toUpperCase(),
      ` ${owner.key}`,
      `${owner.key}\n`,
      owner.key.slice(0, -1),
      `dune-admin.${owner.id}.${'0'.repeat(64)}`,
    ]) {
      await assert.rejects(
        adminLogin(store.database, key, 1000),
        (error: unknown) => {
          assert.ok(denied()(error));
          assert.equal(String(error).includes(owner.key), false);
          return true;
        },
      );
    }
    for (const token of [
      undefined,
      '',
      owner.key,
      'a'.repeat(63),
      'A'.repeat(64),
      'a'.repeat(65),
      'a'.repeat(64) + '\n',
    ])
      await assert.rejects(
        requireAdmin(store.database, token, undefined, 1000),
        denied(),
      );
    assert.equal(snapshot(store), before);
  } finally {
    store.sqlite.close();
  }
});

void test('single-session logout is persisted and idempotently audited without revoking the access key', async () => {
  const store = adminStore();
  try {
    const owner = store.provision();
    const first = await adminLogin(store.database, owner.key, 1000);
    const second = await adminLogin(store.database, owner.key, 1000);
    await adminLogout(store.database, first.token, 2000);
    await assert.rejects(
      requireAdmin(store.database, first.token, undefined, 2000),
      denied(),
    );
    await requireAdmin(store.database, second.token, undefined, 2000);
    const beforeRetry = snapshot(store);
    await adminLogout(store.database, first.token, 3000);
    await adminLogout(store.database, 'malformed', 3000);
    assert.equal(snapshot(store), beforeRetry);
    await adminLogin(store.database, owner.key, 3000);
    assert.equal(
      store.sqlite
        .prepare(
          "SELECT count(*) AS n FROM admin_audit WHERE action = 'logout'",
        )
        .get()!.n,
      1,
    );
  } finally {
    store.sqlite.close();
  }
});

void test('logout-all revokes only the authenticated account and its access key can open a fresh session', async () => {
  const store = adminStore();
  try {
    const owner = store.provision();
    const other = store.provision('viewer');
    const first = await adminLogin(store.database, owner.key, 1000);
    const second = await adminLogin(store.database, owner.key, 1000);
    const observer = await adminLogin(store.database, other.key, 1000);
    const identity = await requireAdmin(
      store.database,
      first.token,
      undefined,
      1000,
    );
    const beforeForged = snapshot(store);
    await assert.rejects(
      adminLogoutAll(store.database, { ...identity, id: other.id }, 2000),
      denied(),
    );
    assert.equal(snapshot(store), beforeForged);
    await adminLogoutAll(store.database, identity, 2000);
    for (const token of [first.token, second.token])
      await assert.rejects(
        requireAdmin(store.database, token, undefined, 2000),
        denied(),
      );
    await requireAdmin(store.database, observer.token, undefined, 2000);
    const beforeRetry = snapshot(store);
    await assert.rejects(
      adminLogoutAll(store.database, identity, 3000),
      denied(),
    );
    assert.equal(snapshot(store), beforeRetry);
    const fresh = await adminLogin(store.database, owner.key, 3000);
    await requireAdmin(store.database, fresh.token, undefined, 3000);
    assert.equal(
      store.sqlite
        .prepare(
          "SELECT count(*) AS n FROM admin_audit WHERE action = 'logout_all'",
        )
        .get()!.n,
      1,
    );
  } finally {
    store.sqlite.close();
  }
});

void test('logout-all rechecks expiry inside its mutation batch', async () => {
  const store = adminStore();
  try {
    const owner = store.provision();
    const login = await adminLogin(store.database, owner.key, 1000);
    const identity = await requireAdmin(
      store.database,
      login.token,
      undefined,
      1000,
    );
    const before = snapshot(store);
    await assert.rejects(
      adminLogoutAll(store.database, identity, login.expiresAt),
      denied(),
    );
    assert.equal(snapshot(store), before);
  } finally {
    store.sqlite.close();
  }
});

void test('a concurrent logout-all fences an already-authorized login before session creation', async () => {
  const store = adminStore();
  try {
    const owner = store.provision();
    const current = await adminLogin(store.database, owner.key, 1000);
    const identity = await requireAdmin(
      store.database,
      current.token,
      undefined,
      1000,
    );
    const gate = pauseAdminBatch(store);
    const pending = adminLogin(store.database, owner.key, 2000);
    await gate.waiting;
    await adminLogoutAll(store.database, identity, 2000);
    const afterRevoke = snapshot(store);
    gate.release();
    await assert.rejects(pending, denied());
    assert.equal(snapshot(store), afterRevoke);
    assert.equal(
      store.sqlite.prepare('SELECT count(*) AS n FROM admin_sessions').get()!.n,
      1,
    );
  } finally {
    store.sqlite.close();
  }
});

void test('concurrent account disable and reenable cannot resurrect an in-flight login or existing sessions', async () => {
  const store = adminStore();
  try {
    const owner = store.provision();
    store.provision('owner');
    const current = await adminLogin(store.database, owner.key, 1000);
    const gate = pauseAdminBatch(store);
    const pending = adminLogin(store.database, owner.key, 2000);
    await gate.waiting;
    store.sqlite
      .prepare('UPDATE admin_accounts SET enabled = 0 WHERE id = ?')
      .run(owner.id);
    await assert.rejects(
      requireAdmin(store.database, current.token, undefined, 2000),
      denied(),
    );
    await assert.rejects(adminLogin(store.database, owner.key, 2000), denied());
    store.sqlite
      .prepare('UPDATE admin_accounts SET enabled = 1 WHERE id = ?')
      .run(owner.id);
    const afterDisable = snapshot(store);
    gate.release();
    await assert.rejects(pending, denied());
    await assert.rejects(
      requireAdmin(store.database, current.token, undefined, 2000),
      denied(),
    );
    assert.equal(snapshot(store), afterDisable);
    assert.equal(
      store.sqlite
        .prepare(
          "SELECT count(*) AS n FROM admin_audit WHERE action = 'revoke'",
        )
        .get()!.n,
      1,
    );
  } finally {
    store.sqlite.close();
  }
});

void test('a concurrent browser logout denies stale logout-all without revoking other browser sessions', async () => {
  const store = adminStore();
  try {
    const owner = store.provision();
    const current = await adminLogin(store.database, owner.key, 1000);
    const other = await adminLogin(store.database, owner.key, 1000);
    const identity = await requireAdmin(
      store.database,
      current.token,
      undefined,
      1000,
    );
    const gate = pauseAdminBatch(store);
    const pending = adminLogoutAll(store.database, identity, 2000);
    await gate.waiting;
    await adminLogout(store.database, current.token, 2000);
    const afterLogout = snapshot(store);
    gate.release();
    await assert.rejects(pending, denied());
    assert.equal(snapshot(store), afterLogout);
    await requireAdmin(store.database, other.token, undefined, 2000);
  } finally {
    store.sqlite.close();
  }
});

void test('concurrent logout-all calls commit a single generation advance and audit event', async () => {
  const store = adminStore();
  try {
    const owner = store.provision();
    const login = await adminLogin(store.database, owner.key, 1000);
    const identity = await requireAdmin(
      store.database,
      login.token,
      undefined,
      1000,
    );
    const gate = pauseAdminBatch(store);
    const pending = adminLogoutAll(store.database, identity, 2000);
    await gate.waiting;
    await adminLogoutAll(store.database, identity, 2000);
    const afterWinner = snapshot(store);
    gate.release();
    await assert.rejects(pending, denied());
    assert.equal(snapshot(store), afterWinner);
    assert.equal(
      store.sqlite
        .prepare('SELECT session_generation FROM admin_accounts WHERE id = ?')
        .get(owner.id)!.session_generation,
      1,
    );
  } finally {
    store.sqlite.close();
  }
});

void test('audit failures roll back both session creation and logout-all generation changes', async () => {
  const store = adminStore();
  try {
    const owner = store.provision();
    store.sqlite.exec(
      "CREATE TRIGGER fail_login_audit BEFORE INSERT ON admin_audit WHEN NEW.action = 'login' BEGIN SELECT RAISE(ABORT, 'audit failure'); END",
    );
    const beforeLogin = snapshot(store);
    await assert.rejects(
      adminLogin(store.database, owner.key, 1000),
      /audit failure/,
    );
    assert.equal(snapshot(store), beforeLogin);
    store.sqlite.exec('DROP TRIGGER fail_login_audit');
    const login = await adminLogin(store.database, owner.key, 1000);
    const identity = await requireAdmin(
      store.database,
      login.token,
      undefined,
      1000,
    );
    store.sqlite.exec(
      "CREATE TRIGGER fail_logout_audit BEFORE INSERT ON admin_audit WHEN NEW.action = 'logout_all' BEGIN SELECT RAISE(ABORT, 'audit failure'); END",
    );
    const beforeLogout = snapshot(store);
    await assert.rejects(
      adminLogoutAll(store.database, identity, 2000),
      /audit failure/,
    );
    assert.equal(snapshot(store), beforeLogout);
    await requireAdmin(store.database, login.token, undefined, 2000);
  } finally {
    store.sqlite.close();
  }
});

void test('operator revocation protects the final enabled owner and persists account, session and audit changes atomically', async () => {
  const store = adminStore();
  try {
    const first = store.provision();
    const second = store.provision('owner', 'Second owner');
    const login = await adminLogin(store.database, first.key, 1000);
    const identity = await requireAdmin(
      store.database,
      login.token,
      undefined,
      1000,
    );
    store.sqlite
      .prepare('UPDATE admin_accounts SET enabled = 0 WHERE id = ?')
      .run(first.id);
    await assert.rejects(
      requireAdmin(store.database, login.token, undefined, 2000),
      denied(),
    );
    await assert.rejects(
      adminLogoutAll(store.database, identity, 2000),
      denied(),
    );
    const beforeDenied = snapshot(store);
    for (const sql of [
      'UPDATE admin_accounts SET enabled = 0 WHERE id = ?',
      "UPDATE admin_accounts SET role = 'operator' WHERE id = ?",
      'DELETE FROM admin_accounts WHERE id = ?',
    ])
      assert.throws(
        () => store.sqlite.prepare(sql).run(second.id),
        /final enabled administrator owner/,
      );
    assert.equal(snapshot(store), beforeDenied);
    assert.equal(
      store.sqlite
        .prepare(
          'SELECT count(*) AS n FROM admin_sessions WHERE admin_id = ? AND revoked_at IS NULL',
        )
        .get(first.id)!.n,
      0,
    );
  } finally {
    store.sqlite.close();
  }
});
