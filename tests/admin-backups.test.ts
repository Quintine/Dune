import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { adminStore, pauseAdminBatch, sha256 } from './admin-access-fixture';
import { AdminError, adminLogin, requireAdmin, type AdminIdentity, type AdminRole } from '../db/admin-access';
import { captureAdminBackup, downloadAdminBackup, listAdminBackups, MAX_BACKUP_BYTES, MAX_BACKUP_DOWNLOADS, MAX_ROOM_BACKUPS, MAX_ROOM_BACKUP_BYTES, MAX_TOTAL_BACKUP_BYTES } from '../db/admin-backups';

const now = 10_000;
const code = 'BACKUPAA';
const fails = (status: number) => (error: unknown) => error instanceof AdminError && error.status === status;
async function fixture(role: AdminRole = 'owner') {
  const store = adminStore();
  const account = store.provision(role);
  const login = await adminLogin(store.database, account.key, now);
  const identity = await requireAdmin(store.database, login.token, undefined, now);
  const privateGame = JSON.stringify({ host: 'Private host', hiddenCards: ['Traitor: Private card'], turn: 3 });
  store.sqlite.prepare('INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)').run(code, privateGame, 7, 9000);
  const sessionHash = sha256('seat-secret');
  store.sqlite.prepare('INSERT INTO seats(token_hash,room_code,player_id,revoked) VALUES(?,?,?,?)').run(sessionHash, code, 'host', 1);
  store.sqlite.prepare('INSERT INTO room_controls(room_code,paused,join_locked,revision,updated_at) VALUES(?,1,1,2,?)').run(code, now);
  store.sqlite.prepare('INSERT INTO room_removals(room_code,removed,revision,removed_at,updated_at) VALUES(?,1,1,?,?)').run(code, now, now);
  store.sqlite.prepare('INSERT INTO room_closures(room_code,closed,revision,closed_at,updated_at) VALUES(?,1,1,?,?)').run(code, now, now);
  store.sqlite.prepare('INSERT INTO room_archives(room_code,archived,revision,archived_at,updated_at) VALUES(?,1,1,?,?)').run(code, now, now);
  store.sqlite.prepare('INSERT INTO seat_recovery_keys(room_code,player_id,recovery_hash,current_operation_hash) VALUES(?,?,?,?)').run(code, 'host', sha256('recovery-secret'), sha256('operation-secret'));
  store.sqlite.prepare('INSERT INTO seat_recovery_receipts(room_code,player_id,operation_hash,recovery_hash,session_hash) VALUES(?,?,?,?,?)').run(code, 'host', sha256('recovery-operation'), sha256('recovery-secret'), sessionHash);
  store.sqlite.prepare('INSERT INTO seat_handover_offers(room_code,player_id,offer_hash,secret_hash,issuer_session_hash,expires_at) VALUES(?,?,?,?,?,?)').run(code, 'host', sha256('offer'), sha256('handover-secret'), sessionHash, now + 1000);
  store.sqlite.prepare('INSERT INTO seat_handover_claim_receipts(room_code,player_id,operation_hash,offer_hash,secret_hash,session_hash,claim_fence,claimed_at) VALUES(?,?,?,?,?,?,?,?)').run(code, 'host', sha256('claim'), sha256('offer'), sha256('handover-secret'), sessionHash, sha256('fence'), now);
  store.sqlite.prepare('INSERT INTO seat_ai_delegations(room_code,owner_id,grant_id,delegate_id,difficulty,owner_session_hash,delegate_session_hash,expires_at) VALUES(?,?,?,?,?,?,?,?)').run(code, 'host', randomUUID(), 'delegate', 'Hard', sessionHash, sha256('delegate-session'), now + 1000);
  store.sqlite.prepare('INSERT INTO room_entry_receipts(operation_hash,request_hash,session_hash,room_code,player_id) VALUES(?,?,?,?,?)').run(sha256('entry-op'), sha256('entry-request'), sessionHash, code, 'host');
  store.sqlite.prepare('INSERT INTO seat_discussion_controls(room_code,player_id,muted,revision,updated_at) VALUES(?,?,1,1,?)').run(code, 'host', now);
  store.sqlite.prepare('INSERT INTO room_messages(room_code,id,sender_id,sender_session_hash,sender_name,sender_faction,recipient_id,recipient_name,body,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(code, randomUUID(), 'host', sessionHash, 'Private host', 'atreides', 'delegate', 'Private recipient', 'private message', now);
  const input = () => ({ roomCode: code, operationId: randomUUID(), expectedVersion: 7, reason: 'Owner maintenance checkpoint' });
  return { ...store, account, identity, privateGame, sessionHash, input };
}

void test('capture preserves every room-owned row and private access revocation without mutating the live room', async () => {
  const store = await fixture();
  try {
    const tables = ['rooms', 'seats', 'room_controls', 'room_removals', 'room_closures', 'room_archives', 'seat_recovery_keys', 'seat_recovery_receipts', 'seat_handover_offers', 'seat_handover_claim_receipts', 'seat_ai_delegations', 'room_entry_receipts', 'seat_discussion_controls', 'room_messages'];
    const before = tables.map(table => store.sqlite.prepare(`SELECT * FROM ${table}`).all());
    const first = await captureAdminBackup(store.database, store.identity, store.input(), now);
    const listed = await listAdminBackups(store.database, store.identity, code, now);
    assert.deepEqual(listed, [first.backup]);
    assert.equal(JSON.stringify(listed).includes('private message'), false);
    assert.equal(JSON.stringify(listed).includes(store.sessionHash), false);
    const downloaded = await downloadAdminBackup(store.database, store.identity, first.backup.id, now);
    const data = JSON.parse(downloaded.payload);
    assert.equal(data.format, 1);
    assert.equal(data.room.state, store.privateGame);
    assert.equal(data.room.version, 7);
    for (let index = 1; index < tables.length; index++)
      assert.deepEqual(data.tables[tables[index]], JSON.parse(JSON.stringify(before[index])));
    assert.equal(data.tables.seats[0].revoked, 1);
    assert.equal(first.backup.sizeBytes, Buffer.byteLength(downloaded.payload));
    assert.equal(first.backup.digest, sha256(downloaded.payload));
    const audit = store.sqlite.prepare('SELECT operation_id,actor_admin_id,room_code,created_at FROM admin_room_backup_downloads').all();
    assert.deepEqual(JSON.parse(JSON.stringify(audit)), [{ operation_id: first.backup.id, actor_admin_id: store.identity.id, room_code: code, created_at: now }]);
    assert.deepEqual(tables.map(table => store.sqlite.prepare(`SELECT * FROM ${table}`).all()), before);
    assert.equal(store.sqlite.prepare('SELECT actor_admin_id,room_code,reason FROM admin_room_backups').get()!.actor_admin_id, store.identity.id);
  } finally { store.sqlite.close(); }
});

void test('operation ID binds exact actor/request and replays the same immutable bytes after room changes', async () => {
  const store = await fixture();
  try {
    const input = store.input();
    const first = await captureAdminBackup(store.database, store.identity, input, now);
    store.sqlite.prepare('UPDATE rooms SET version=8,state=? WHERE code=?').run('{"new":"private state"}', code);
    const replay = await captureAdminBackup(store.database, store.identity, input, now);
    assert.deepEqual(replay, { ...first, replayed: true });
    assert.equal((await downloadAdminBackup(store.database, store.identity, input.operationId, now)).payload.includes('new'), false);
    await assert.rejects(captureAdminBackup(store.database, store.identity, { ...input, reason: 'different request' }, now), fails(409));
    await assert.rejects(captureAdminBackup(store.database, store.identity, store.input(), now), fails(409));
    const secondOwner = store.provision();
    const login = await adminLogin(store.database, secondOwner.key, now);
    const identity = await requireAdmin(store.database, login.token, ['owner'], now);
    await assert.rejects(captureAdminBackup(store.database, identity, input, now), fails(409));
    assert.equal(store.sqlite.prepare('SELECT COUNT(*) AS count FROM admin_room_backups').get()!.count, 1);
  } finally { store.sqlite.close(); }
});

void test('live revocation, version advances and unversioned writes during staged capture cannot create or leak a backup', async () => {
  const store = await fixture();
  try {
    const input = store.input();
    const gate = pauseAdminBatch(store);
    const pending = captureAdminBackup(store.database, store.identity, input, now);
    await gate.waiting;
    store.sqlite.prepare('UPDATE admin_accounts SET session_generation=session_generation+1 WHERE id=?').run(store.identity.id);
    gate.release();
    await assert.rejects(pending, fails(403));
    await assert.rejects(listAdminBackups(store.database, store.identity, code, now), fails(403));
    await assert.rejects(downloadAdminBackup(store.database, store.identity, input.operationId, now), fails(403));
    assert.equal(store.sqlite.prepare('SELECT COUNT(*) AS count FROM admin_room_backups').get()!.count, 0);
  } finally { store.sqlite.close(); }
  const changed = await fixture();
  try {
    const input = changed.input();
    const gate = pauseAdminBatch(changed);
    const pending = captureAdminBackup(changed.database, changed.identity, input, now);
    await gate.waiting;
    changed.sqlite.prepare('UPDATE room_messages SET body=? WHERE room_code=?').run('new private message', code);
    gate.release();
    await assert.rejects(pending, fails(409));
    assert.equal(changed.sqlite.prepare('SELECT COUNT(*) AS count FROM admin_room_backups').get()!.count, 0);
  } finally { changed.sqlite.close(); }
  const advanced = await fixture();
  try {
    const input = advanced.input();
    const gate = pauseAdminBatch(advanced);
    const pending = captureAdminBackup(advanced.database, advanced.identity, input, now);
    await gate.waiting;
    advanced.sqlite.prepare('UPDATE rooms SET version=version+1 WHERE code=?').run(code);
    gate.release();
    await assert.rejects(pending, fails(409));
    assert.equal(advanced.sqlite.prepare('SELECT COUNT(*) AS count FROM admin_room_backups').get()!.count, 0);
  } finally { advanced.sqlite.close(); }
});

void test('viewer/operator, revoked owner, and seat credentials cannot download private backups', async () => {
  const store = await fixture();
  try {
    const id = (await captureAdminBackup(store.database, store.identity, store.input(), now)).backup.id;
    for (const role of ['viewer', 'operator'] as const) {
      const account = store.provision(role);
      const login = await adminLogin(store.database, account.key, now);
      const identity = await requireAdmin(store.database, login.token, undefined, now);
      await assert.rejects(downloadAdminBackup(store.database, identity, id, now), fails(403));
      await assert.rejects(listAdminBackups(store.database, identity, code, now), fails(403));
    }
    await assert.rejects(downloadAdminBackup(store.database, { ...store.identity, sessionHash: store.sessionHash }, id, now), fails(403));
    store.sqlite.prepare('UPDATE admin_sessions SET revoked_at=? WHERE token_hash=?').run(now, store.identity.sessionHash);
    await assert.rejects(downloadAdminBackup(store.database, store.identity, id, now), fails(403));
    assert.equal(store.sqlite.prepare('SELECT COUNT(*) AS count FROM admin_room_backup_downloads').get()!.count, 0);
    assert.equal(store.sqlite.prepare('SELECT COUNT(*) AS count FROM admin_room_backups').get()!.count, 1);
  } finally { store.sqlite.close(); }
});

void test('oversized room is rejected before persistence without truncation', async () => {
  const store = await fixture();
  try {
    store.sqlite.prepare('UPDATE rooms SET state=? WHERE code=?').run('🔒'.repeat(MAX_BACKUP_BYTES / 4), code);
    await assert.rejects(captureAdminBackup(store.database, store.identity, store.input(), now), fails(413));
    assert.equal(store.sqlite.prepare('SELECT COUNT(*) AS count FROM admin_room_backups').get()!.count, 0);
  } finally { store.sqlite.close(); }
});

void test('the larger bounded format preserves substantial private discussion without truncation', async () => {
  const store = await fixture();
  try {
    const body = 'private discussion '.repeat(40_000);
    store.sqlite.prepare('UPDATE room_messages SET body=? WHERE room_code=?').run(body, code);
    const backup = await captureAdminBackup(store.database, store.identity, store.input(), now);
    assert.ok(backup.backup.sizeBytes > 512 * 1024 && backup.backup.sizeBytes < MAX_BACKUP_BYTES);
    const payload = JSON.parse((await downloadAdminBackup(store.database, store.identity, backup.backup.id, now)).payload);
    assert.equal(payload.tables.room_messages[0].body, body);
  } finally { store.sqlite.close(); }
});

void test('oversized request rechecks an exact operation committed while its status was pending', async () => {
  const store = await fixture();
  try {
    const input = store.input();
    store.sqlite.prepare('UPDATE rooms SET state=? WHERE code=?').run('🔒'.repeat(MAX_BACKUP_BYTES / 4), code);
    const gate = pauseAdminBatch(store);
    const pending = captureAdminBackup(store.database, store.identity, input, now);
    await gate.waiting;
    store.sqlite.prepare('UPDATE rooms SET state=? WHERE code=?').run(store.privateGame, code);
    const winner = await captureAdminBackup(store.database, store.identity, input, now);
    gate.release();
    assert.deepEqual(await pending, { ...winner, replayed: true });
    assert.equal(store.sqlite.prepare('SELECT COUNT(*) AS count FROM admin_room_backups').get()!.count, 1);
  } finally { store.sqlite.close(); }
});

void test('duplicate snapshot is rejected but unversioned content change permits a new capture', async () => {
  const store = await fixture();
  try {
    await captureAdminBackup(store.database, store.identity, store.input(), now);
    await assert.rejects(captureAdminBackup(store.database, store.identity, store.input(), now), fails(409));
    store.sqlite.prepare('UPDATE room_messages SET body=? WHERE room_code=?').run('changed private message', code);
    const next = await captureAdminBackup(store.database, store.identity, store.input(), now);
    assert.equal(next.backup.roomVersion, 7);
    assert.equal(store.sqlite.prepare('SELECT COUNT(*) AS count FROM admin_room_backups').get()!.count, 2);
  } finally { store.sqlite.close(); }
});

function seedPriorBackups(store: { sqlite: DatabaseSync; identity: AdminIdentity }, count: number, room: string, bytes: number) {
  for (let index = 0; index < count; index++)
    store.sqlite.prepare(`INSERT INTO admin_room_backups
      (operation_id,actor_admin_id,room_code,request_hash,room_version,created_at,size_bytes,digest,payload,reason)
      VALUES(?,?,?,?,?,?,?,'prior',CAST(zeroblob(?) AS TEXT),'prior')`).run(
      randomUUID(), store.identity.id, room, 'prior', index, now - 1, bytes, bytes,
    );
}

void test('per-room count and byte quotas and global byte quota reject new IDs without deleting prior receipts', async () => {
  const count = await fixture();
  try {
    seedPriorBackups(count, MAX_ROOM_BACKUPS, code, 2);
    await assert.rejects(captureAdminBackup(count.database, count.identity, count.input(), now), fails(507));
    assert.equal(count.sqlite.prepare('SELECT COUNT(*) AS count FROM admin_room_backups').get()!.count, MAX_ROOM_BACKUPS);
  } finally { count.sqlite.close(); }
  const roomBytes = await fixture();
  try {
    seedPriorBackups(roomBytes, Math.ceil(MAX_ROOM_BACKUP_BYTES / 1_700_000), code, 1_700_000);
    await assert.rejects(captureAdminBackup(roomBytes.database, roomBytes.identity, roomBytes.input(), now), fails(507));
  } finally { roomBytes.sqlite.close(); }
  const total = await fixture();
  try {
    const rows = Math.ceil(MAX_TOTAL_BACKUP_BYTES / 1_700_000);
    seedPriorBackups(total, rows, 'OTHERAAA', 1_700_000);
    await assert.rejects(captureAdminBackup(total.database, total.identity, total.input(), now), fails(507));
    assert.equal(total.sqlite.prepare('SELECT COUNT(*) AS count FROM admin_room_backups').get()!.count, rows);
  } finally { total.sqlite.close(); }
});

void test('a failed or revoked export cannot return private bytes or append an audit receipt', async () => {
  const store = await fixture();
  try {
    const id = (await captureAdminBackup(store.database, store.identity, store.input(), now)).backup.id;
    store.sqlite.exec(`CREATE TRIGGER reject_backup_export BEFORE INSERT ON admin_room_backup_downloads
      BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END`);
    await assert.rejects(downloadAdminBackup(store.database, store.identity, id, now), /audit unavailable/);
    store.sqlite.exec('DROP TRIGGER reject_backup_export');
    const gate = pauseAdminBatch(store);
    const pending = downloadAdminBackup(store.database, store.identity, id, now);
    await gate.waiting;
    store.sqlite.prepare('UPDATE admin_accounts SET session_generation=session_generation+1 WHERE id=?').run(store.identity.id);
    gate.release();
    await assert.rejects(pending, fails(403));
    assert.equal(store.sqlite.prepare('SELECT COUNT(*) AS count FROM admin_room_backup_downloads').get()!.count, 0);
  } finally { store.sqlite.close(); }
});

void test('highly escaped valid stored state over D1 JSON expansion limit returns 413 and exact prior operation still replays', async () => {
  const store = await fixture();
  try {
    const firstInput = store.input();
    const first = await captureAdminBackup(store.database, store.identity, firstInput, now);
    const escapedState = JSON.stringify({ secret: '\\'.repeat(650_000) });
    assert.ok(Buffer.byteLength(escapedState) < 2_000_000);
    store.sqlite.prepare('UPDATE rooms SET state=? WHERE code=?').run(escapedState, code);
    await assert.rejects(captureAdminBackup(store.database, store.identity, store.input(), now), fails(413));
    assert.deepEqual(await captureAdminBackup(store.database, store.identity, firstInput, now), { ...first, replayed: true });
    assert.equal(store.sqlite.prepare('SELECT state FROM rooms WHERE code=?').get(code)!.state, escapedState);
    assert.equal(store.sqlite.prepare('SELECT COUNT(*) AS count FROM admin_room_backups').get()!.count, 1);
  } finally { store.sqlite.close(); }
});

void test('audit capacity rejects an authorized export without releasing bytes or changing the backup', async () => {
  const store = await fixture();
  try {
    const id = (await captureAdminBackup(store.database, store.identity, store.input(), now)).backup.id;
    const original = store.sqlite.prepare('SELECT payload FROM admin_room_backups WHERE operation_id=?').get(id)!.payload;
    store.sqlite.prepare(`WITH RECURSIVE seq(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM seq WHERE n < ?)
      INSERT INTO admin_room_backup_downloads(download_id,operation_id,actor_admin_id,room_code,created_at)
      SELECT printf('%08x-0000-4000-8000-%012x',n,n),?,?,?,? FROM seq`).run(
      MAX_BACKUP_DOWNLOADS, id, store.identity.id, code, now,
    );
    await assert.rejects(downloadAdminBackup(store.database, store.identity, id, now), fails(507));
    assert.equal(store.sqlite.prepare('SELECT COUNT(*) AS count FROM admin_room_backup_downloads').get()!.count, MAX_BACKUP_DOWNLOADS);
    assert.equal(store.sqlite.prepare('SELECT payload FROM admin_room_backups WHERE operation_id=?').get(id)!.payload, original);
    assert.equal(store.sqlite.prepare('SELECT version FROM rooms WHERE code=?').get(code)!.version, 7);
  } finally { store.sqlite.close(); }
});
