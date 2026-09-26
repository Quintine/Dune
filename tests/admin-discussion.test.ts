import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { adminStore } from './admin-access-fixture';
import { adminLogin, requireAdmin, AdminError, type AdminRole } from '../db/admin-access';
import { readAdminDiscussion, applyAdminDiscussion } from '../db/admin-discussion';
import { createGame, newPlayer } from '../game/engine';
import { adminDiscussionConfirmation } from '../lib/admin-discussion-client';
import type { AdminDiscussionInput } from '../lib/admin-discussion';

const now = 10_000, code = 'MUTEQAAA';
const denied = (error: unknown) => error instanceof AdminError && [401,403,409].includes(error.status);
async function fixture(role: AdminRole = 'operator') {
  const store = adminStore(); assert.ok(store.sqlite instanceof DatabaseSync);
  const account = store.provision(role, 'Private administrator identity');
  const login = await adminLogin(store.database, account.key, now);
  const identity = await requireAdmin(store.database, login.token, undefined, now);
  const player = newPlayer(randomUUID(), 'Public participant', 'atreides');
  const game = createGame(code, player);
  store.sqlite.prepare('INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)').run(code, JSON.stringify(game), 7, 42);
  const input: AdminDiscussionInput = { operationId: randomUUID(), expectedVersion: 7, expectedRevision: 0, target: player.id, muted: true, reason: 'Private operational reason' };
  const apply = (request = input) => applyAdminDiscussion(store.database, identity, code, request, now);
  const rooms = () => store.sqlite.prepare('SELECT * FROM rooms ORDER BY code').all();
  const controls = () => store.sqlite.prepare('SELECT * FROM seat_discussion_controls').all();
  const audits = () => store.sqlite.prepare('SELECT * FROM admin_discussion_operations').all();
  return { ...store, identity, player, input, apply, rooms, controls, audits };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function pauseCommit(f: Fixture) {
  let enter!: () => void, release!: () => void, calls = 0;
  const waiting = new Promise<void>(resolve => { enter = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  f.hooks.beforeBatch = async () => { if (++calls === 2) { delete f.hooks.beforeBatch; enter(); await gate; } };
  return { waiting, release };
}
void test('discussion moderation changes only metadata; old receipt after unmute/removal never reapplies', async () => {
  const f = await fixture();
  try {
    f.sqlite.prepare('INSERT INTO rooms(code,state,version,updated_at) SELECT ?,state,version,updated_at FROM rooms WHERE code=?').run('OTHERQAA', code);
    f.sqlite.prepare('INSERT INTO seats(token_hash,room_code,player_id) VALUES(?,?,?)').run('private seat hash', code, f.player.id);
    const before = f.rooms(), seats = f.sqlite.prepare('SELECT * FROM seats').all();
    const first = await f.apply(); adminDiscussionConfirmation(first, code, f.input);
    assert.equal(first.replayed, false); assert.equal(first.room.players[0].muted, true);
    assert.deepEqual(Object.keys(first.room.players[0]).sort(), ['control','faction','id','muted','name','revision']);
    assert.doesNotMatch(JSON.stringify(first), /Private|token_hash|traitor|hand|recovery/i);
    await f.apply({ ...f.input, operationId: randomUUID(), expectedRevision: 1, muted: false });
    const retry = await f.apply(); adminDiscussionConfirmation(retry, code, f.input);
    assert.equal(retry.replayed, true); assert.equal(retry.room.players[0].muted, false);
    f.sqlite.prepare('INSERT INTO room_removals(room_code,removed,revision,removed_at,updated_at) VALUES(?,1,1,1,1)').run(code);
    assert.equal((await f.apply()).room.removed, true);
    await assert.rejects(() => f.apply({ ...f.input, operationId: randomUUID(), expectedRevision: 2 }), denied);
    await assert.rejects(() => f.apply({ ...f.input, reason: 'Changed payload' }), denied);
    assert.equal(f.audits().length, 2); assert.deepEqual(f.rooms(), before); assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), seats);
  } finally { f.sqlite.close(); }
});
void test('closed archived rooms permit settings for reopening without exposing discussion or requiring a seat credential', async () => {
  const f = await fixture();
  try {
    f.sqlite.prepare('INSERT INTO room_closures(room_code,closed,revision,closed_at,updated_at) VALUES(?,1,1,1,1)').run(code);
    f.sqlite.prepare('INSERT INTO room_archives(room_code,archived,revision,archived_at,updated_at) VALUES(?,1,1,1,1)').run(code);
    const before = f.rooms(), result = await f.apply();
    assert.equal(result.room.archived, true); assert.equal(result.room.closed, true); assert.equal(result.room.players[0].muted, true); assert.deepEqual(f.rooms(), before);
  } finally { f.sqlite.close(); }
});
for (const [name, sql] of [
  ['operator demotion', "UPDATE admin_accounts SET role='viewer'"], ['operator disable', 'UPDATE admin_accounts SET enabled=0'],
  ['session revocation', 'UPDATE admin_sessions SET revoked_at=1'], ['session generation', 'UPDATE admin_accounts SET session_generation=session_generation+1'],
  ['session expiration', 'UPDATE admin_sessions SET expires_at=1'], ['room version', 'UPDATE rooms SET version=version+1'],
  ['room removal', "INSERT INTO room_removals(room_code,removed,revision,removed_at,updated_at) VALUES('MUTEQAAA',1,1,1,1)"],
  ['human conversion', "UPDATE rooms SET state=json_set(state,'$.players[0].bot','Easy')"],
  ['membership removal', "UPDATE rooms SET state=json_set(state,'$.players',json('[]'))"],
]) void test(`discussion write fences ${name} at commit`, async () => {
  const f = await fixture();
  try {
    let batches = 0;
    f.hooks.beforeBatch = async () => { if (++batches === 2) { delete f.hooks.beforeBatch; f.sqlite.exec(sql); } };
    await assert.rejects(f.apply, denied); assert.equal(f.controls().length, 0); assert.equal(f.audits().length, 0);
  } finally { f.sqlite.close(); }
});
void test('failed moderation audit rolls back metadata', async () => {
  const f = await fixture();
  try {
    const before = f.rooms();
    f.sqlite.exec("CREATE TRIGGER reject_receipt BEFORE INSERT ON admin_discussion_operations BEGIN SELECT RAISE(ABORT,'audit blocked'); END;");
    await assert.rejects(f.apply, /audit blocked/); assert.equal(f.controls().length, 0); assert.equal(f.audits().length, 0); assert.deepEqual(f.rooms(), before);
  } finally { f.sqlite.close(); }
});
for (const different of [false, true]) void test(`racing ${different ? 'conflicting' : 'identical'} discussion operations retain one audit`, async () => {
  const f = await fixture();
  try {
    const barrier = pauseCommit(f), pending = f.apply(); await barrier.waiting;
    assert.equal((await f.apply(different ? { ...f.input, reason: 'Different reason' } : f.input)).replayed, false);
    barrier.release();
    if (different) await assert.rejects(() => pending, denied); else assert.equal((await pending).replayed, true);
    assert.equal(f.audits().length, 1); assert.equal(f.controls()[0].revision, 1);
  } finally { f.sqlite.close(); }
});
void test('mute/unmute race rejects stale metadata revision even though game version remains unchanged', async () => {
  const f = await fixture();
  try {
    const before = f.rooms(), barrier = pauseCommit(f), pending = f.apply(); await barrier.waiting;
    await f.apply({ ...f.input, operationId: randomUUID() });
    await f.apply({ ...f.input, operationId: randomUUID(), expectedRevision: 1, muted: false });
    barrier.release(); await assert.rejects(() => pending, denied);
    assert.equal(f.audits().length, 2); assert.equal(f.controls()[0].muted, 0); assert.deepEqual(f.rooms(), before);
  } finally { f.sqlite.close(); }
});
void test('viewer is read-only and malformed roster is rejected without reflecting private contents', async () => {
  const f = await fixture('viewer');
  try {
    assert.equal((await readAdminDiscussion(f.database, f.identity, code, now)).players.length, 1);
    await assert.rejects(f.apply, denied);
    f.sqlite.prepare('UPDATE rooms SET state=? WHERE code=?').run('{"status":"playing","players":"PRIVATE CREDENTIAL"}', code);
    const view = await readAdminDiscussion(f.database, f.identity, code, now);
    assert.equal(view.editable, false); assert.equal(view.status, 'unreadable'); assert.deepEqual(view.players, []);
    assert.doesNotMatch(JSON.stringify(view), /PRIVATE CREDENTIAL/); assert.equal(f.audits().length, 0);
  } finally { f.sqlite.close(); }
});
