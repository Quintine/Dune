import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { adminLogin, requireAdmin, AdminError } from '../db/admin-access';
import { readAdminIntegrity, readAdminOperations } from '../db/admin-operations';
import { adminStore } from './admin-access-fixture';

const now = 10_000;

void test('owner operations sample counts saved states and backup provenance without leaking contents or changing rooms', async () => {
  const store = adminStore();
  try {
    const owner = store.provision('owner');
    const login = await adminLogin(store.database, owner.key, now);
    const identity = await requireAdmin(store.database, login.token, ['owner'], now);
    store.sqlite.prepare('INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)').run('OPERAABC', '{"private":"sealed card"}', 12, 9000);
    store.sqlite.prepare('INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)').run('OPERAABD', '{broken private state', 3, 9200);
    store.sqlite.prepare('INSERT INTO seats(token_hash,room_code,player_id,revoked) VALUES(?,?,?,0)').run('private-session', 'OPERAABC', 'one');
    store.sqlite.prepare('INSERT INTO seats(token_hash,room_code,player_id,revoked) VALUES(?,?,?,1)').run('revoked-session', 'OPERAABC', 'two');
    store.sqlite.prepare('INSERT INTO room_removals(room_code,removed,revision,removed_at,updated_at) VALUES(?,1,1,?,?)').run('OPERAABD', now, now);
    store.sqlite.prepare('INSERT INTO room_archives(room_code,archived,revision,archived_at,updated_at) VALUES(?,1,1,?,?)').run('OPERAABD', now, now);
    store.sqlite.prepare('INSERT INTO room_controls(room_code,paused,join_locked,revision,updated_at) VALUES(?,1,0,1,?)').run('OPERAABC', now);
    store.sqlite.prepare('INSERT INTO room_closures(room_code,closed,revision,closed_at,updated_at) VALUES(?,1,1,?,?)').run('OPERAABD', now, now);
    const backupId = randomUUID();
    store.sqlite.prepare(`INSERT INTO admin_room_backups
      (operation_id,actor_admin_id,room_code,request_hash,room_version,created_at,size_bytes,digest,payload,reason)
      VALUES(?,?,?,'request',12,?,14,'digest','secret payload','private reason')`).run(backupId, owner.id, 'OPERAABC', now);
    store.sqlite.prepare('INSERT INTO admin_room_backup_downloads(download_id,operation_id,actor_admin_id,room_code,created_at) VALUES(?,?,?,?,?)').run(randomUUID(), backupId, owner.id, 'OPERAABC', now);
    const before = store.sqlite.prepare('SELECT code,state,version FROM rooms ORDER BY code').all();
    const result = await readAdminOperations(store.database, identity, now);
    assert.deepEqual(result, {
      observedAt: now, rooms: 2, removedRooms: 1, archivedRooms: 1,
      pausedRooms: 1, closedRooms: 1, activeSeats: 1, unreadableRooms: 1,
      lastRoomChange: 9200, backupSnapshots: 1, backupBytes: 14, backupDownloads: 1,
    });
    assert.equal(JSON.stringify(result).includes('secret'), false);
    assert.deepEqual(store.sqlite.prepare('SELECT code,state,version FROM rooms ORDER BY code').all(), before);
    assert.deepEqual(await readAdminIntegrity(store.database, identity, now),
      { observedAt: now, sqlite: 'passed', foreignKeys: 'passed' });
    assert.deepEqual(store.sqlite.prepare('SELECT code,state,version FROM rooms ORDER BY code').all(), before);
  } finally { store.sqlite.close(); }
});

void test('stale owner identity, demotion and revoked session cannot sample operational counts', async () => {
  const store = adminStore();
  try {
    const owner = store.provision('owner');
    store.provision('owner', 'Other owner');
    const login = await adminLogin(store.database, owner.key, now);
    const identity = await requireAdmin(store.database, login.token, ['owner'], now);
    const denied = (error: unknown) => error instanceof AdminError && error.status === 403;
    store.sqlite.prepare("UPDATE admin_accounts SET role='operator' WHERE id=?").run(owner.id);
    await assert.rejects(readAdminOperations(store.database, identity, now), denied);
    store.sqlite.prepare("UPDATE admin_accounts SET role='owner' WHERE id=?").run(owner.id);
    store.sqlite.prepare('UPDATE admin_sessions SET revoked_at=? WHERE token_hash=?').run(now, identity.sessionHash);
    await assert.rejects(readAdminOperations(store.database, identity, now), denied);
  } finally { store.sqlite.close(); }
});

void test('manual integrity check detects orphaned foreign keys without exposing their rows', async () => {
  const store = adminStore();
  try {
    const owner = store.provision('owner');
    const login = await adminLogin(store.database, owner.key, now);
    const identity = await requireAdmin(store.database, login.token, ['owner'], now);
    store.sqlite.exec('PRAGMA foreign_keys=OFF');
    store.sqlite.prepare('INSERT INTO seats(token_hash,room_code,player_id,revoked) VALUES(?,?,?,0)')
      .run('private-orphan-token', 'GHOSTABC', 'private-player');
    store.sqlite.exec('PRAGMA foreign_keys=ON');
    const before = store.sqlite.prepare('SELECT * FROM seats').all();
    const result = await readAdminIntegrity(store.database, identity, now);
    assert.deepEqual(result, { observedAt: now, sqlite: 'passed', foreignKeys: 'failed' });
    assert.equal(JSON.stringify(result).includes('private'), false);
    assert.deepEqual(store.sqlite.prepare('SELECT * FROM seats').all(), before);
    store.provision('owner', 'Backup owner');
    store.sqlite.prepare("UPDATE admin_accounts SET role='operator' WHERE id=?").run(owner.id);
    await assert.rejects(readAdminIntegrity(store.database, identity, now),
      (error: unknown) => error instanceof AdminError && error.status === 403);
  } finally { store.sqlite.close(); }
});

void test('manual integrity check revalidates owner authority before returning results', async () => {
  const store = adminStore();
  try {
    const owner = store.provision('owner');
    store.provision('owner', 'Remaining owner');
    const login = await adminLogin(store.database, owner.key, now);
    const identity = await requireAdmin(store.database, login.token, ['owner'], now);
    store.hooks.beforeBatch = async () => {
      store.sqlite.prepare("UPDATE admin_accounts SET role='viewer' WHERE id=?").run(owner.id);
    };
    await assert.rejects(readAdminIntegrity(store.database, identity, now),
      (error: unknown) => error instanceof AdminError && error.status === 403);
  } finally { store.sqlite.close(); }
});
