import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { adminStore, sha256 } from './admin-access-fixture';
import { adminLogin, requireAdmin, AdminError, type AdminRole } from '../db/admin-access';
import { applyAdminSeatAi, readAdminSeatAi } from '../db/admin-seat-ai';
import { applyAdminRoomControl } from '../db/admin-lifecycle';
import { createGame, joinGame, newPlayer, applyAction, type Game } from '../game/engine';
import { adminSeatAiConfirmation } from '../lib/admin-seat-ai-client';
import type { AdminSeatAiInput } from '../lib/admin-seat-ai';

const now = 10_000, code = 'SEATSQLS';
const status = (...wanted: number[]) => (error: unknown) => error instanceof AdminError && wanted.includes(error.status);
async function fixture(role: AdminRole = 'operator') {
  const store = adminStore(); assert.ok(store.sqlite instanceof DatabaseSync);
  const account = store.provision(role, 'Private administrator identity');
  const login = await adminLogin(store.database, account.key, now);
  const identity = await requireAdmin(store.database, login.token, undefined, now);
  const owner = newPlayer(randomUUID(), 'QA Owner', 'atreides'), other = newPlayer(randomUUID(), 'QA Other', 'emperor');
  let game = createGame(code, owner); joinGame(game, other);
  game = applyAction(game, owner.id, { type: 'ready' });
  game = applyAction(game, other.id, { type: 'ready' });
  game = applyAction(game, owner.id, { type: 'start' });
  game.botsPending = true; game.botNextActionAt = 50_000;
  store.sqlite.prepare('INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)').run(code, JSON.stringify(game), 0, 1);
  store.sqlite.prepare('INSERT INTO room_controls(room_code,paused,revision,updated_at) VALUES(?,1,1,1)').run(code);
  const tokenHash = sha256('QA-owner-seat');
  store.sqlite.prepare('INSERT INTO seats(token_hash,room_code,player_id,revoked) VALUES(?,?,?,0)').run(tokenHash, code, owner.id);
  store.sqlite.prepare('INSERT INTO seats(token_hash,room_code,player_id,revoked) VALUES(?,?,?,0)').run(sha256('QA-other-seat'), code, other.id);
  const input: AdminSeatAiInput = { operationId: randomUUID(), expectedVersion: 0, expectedControlRevision: 1, target: owner.id, difficulty: 'Hard', reason: 'Private operational reason' };
  const apply = (request = input) => applyAdminSeatAi(store.database, identity, code, request, now);
  const row = () => store.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get(code)! as { code: string; state: string; version: number; updated_at: number };
  const saved = (): Game => JSON.parse(row().state);
  const auditCount = () => Number(store.sqlite.prepare('SELECT COUNT(*) AS n FROM admin_seat_ai_operations').get()!.n);
  return { ...store, identity, input, owner, other, tokenHash, apply, row, saved, auditCount };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function pauseCommit(f: Fixture) {
  let enter!: () => void, release!: () => void, calls = 0;
  const waiting = new Promise<void>(resolve => { enter = resolve; }), gate = new Promise<void>(resolve => { release = resolve; });
  f.hooks.beforeBatch = async () => { if (++calls === 2) { delete f.hooks.beforeBatch; enter(); await gate; } };
  return { waiting, release };
}

void test('participant AI transaction preserves private custody, credentials, pause pacing and unrelated rooms', async () => {
  const f = await fixture();
  try {
    const insert = f.sqlite.prepare('INSERT INTO seat_ai_delegations(room_code,owner_id,grant_id,delegate_id,difficulty,owner_session_hash,delegate_session_hash,expires_at,used_at,revoked_at) VALUES(?,?,?,?,?,?,?,?,?,?)');
    const grants: [string,string,string,number|null,number|null][] = [
      ['unused', f.owner.id, f.other.id, null, null], ['used', f.owner.id, f.other.id, 99, null],
      ['revoked', f.owner.id, f.other.id, null, 99], ['incoming', f.other.id, f.owner.id, null, null],
    ];
    for (const [grant, owner, delegate, used, revoked] of grants) insert.run(code, owner, grant, delegate, 'Easy', f.tokenHash, sha256('QA-other-seat'), now + 100, used, revoked);
    f.sqlite.prepare('INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)').run('OTHERQAA', f.row().state, 20, 50);
    const otherRoom = f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get('OTHERQAA');
    const seats = f.sqlite.prepare('SELECT * FROM seats').all(), original = f.saved();
    const result = await f.apply(); adminSeatAiConfirmation(result, code, f.input);
    assert.equal(result.replayed, false); assert.equal(result.appliedVersion, 1);
    const next = f.saved(), expected = structuredClone(original);
    expected.players[0].autopilot = 'Hard'; expected.version = 1; expected.log.push(next.log.at(-1)!);
    assert.deepEqual(next, expected);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), seats);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms WHERE code=?').get('OTHERQAA'), otherRoom);
    assert.deepEqual(f.sqlite.prepare('SELECT grant_id,used_at,revoked_at FROM seat_ai_delegations ORDER BY grant_id').all().map(row => ({ ...row })), [
      { grant_id: 'incoming', used_at: null, revoked_at: null }, { grant_id: 'revoked', used_at: null, revoked_at: 99 },
      { grant_id: 'unused', used_at: null, revoked_at: now }, { grant_id: 'used', used_at: 99, revoked_at: null },
    ]);
    assert.deepEqual(Object.keys(result.room.players[0]).sort(), ['control','difficulty','eligible','faction','id','name']);
    assert.doesNotMatch(JSON.stringify(result), /Private administrator identity|Private operational reason|token_hash|traitor|hand|recovery/i);
    assert.equal(f.auditCount(), 1);
  } finally { f.sqlite.close(); }
});

void test('exact participant retry after takeback, resume and removal never reapplies controller change', async () => {
  const f = await fixture();
  try {
    await f.apply();
    const later = applyAction(f.saved(), f.owner.id, { type: 'setAutopilot', difficulty: null }); later.version = 2;
    f.sqlite.prepare('UPDATE rooms SET state=?,version=2 WHERE code=?').run(JSON.stringify(later), code);
    f.sqlite.prepare('UPDATE room_controls SET paused=0,revision=2 WHERE room_code=?').run(code);
    f.sqlite.prepare('INSERT INTO room_removals(room_code,removed,revision,removed_at,updated_at) VALUES(?,1,1,1,1)').run(code);
    const stable = f.row(), replay = await f.apply(); adminSeatAiConfirmation(replay, code, f.input);
    assert.equal(replay.replayed, true); assert.equal(replay.room.removed, true); assert.equal(replay.room.players[0].control, 'human');
    assert.deepEqual(f.row(), stable); assert.equal(f.auditCount(), 1);
    await assert.rejects(() => f.apply({ ...f.input, difficulty: 'Easy' }), status(409));
  } finally { f.sqlite.close(); }
});

for (const [name, sql] of [
  ['seat revocation', 'UPDATE seats SET revoked=1'], ['version change', 'UPDATE rooms SET version=version+1'],
  ['resume', 'UPDATE room_controls SET paused=0,revision=revision+1'], ['control revision', 'UPDATE room_controls SET revision=revision+1'],
  ['removal', "INSERT INTO room_removals(room_code,removed,revision,removed_at,updated_at) VALUES('SEATSQLS',1,1,1,1)"],
  ['closure', "INSERT INTO room_closures(room_code,closed,revision,closed_at,updated_at) VALUES('SEATSQLS',1,1,1,1)"],
  ['archive', "INSERT INTO room_archives(room_code,archived,revision,archived_at,updated_at) VALUES('SEATSQLS',1,1,1,1)"],
  ['role demotion', "UPDATE admin_accounts SET role='viewer'"], ['session revocation', 'UPDATE admin_sessions SET revoked_at=1'],
  ['session generation', 'UPDATE admin_accounts SET session_generation=session_generation+1'], ['session expiry', 'UPDATE admin_sessions SET expires_at=1'],
]) void test(`participant AI commit fences ${name}`, async () => {
  const f = await fixture();
  try {
    const original = f.row().state; let calls = 0;
    f.hooks.beforeBatch = async () => { if (++calls === 2) { delete f.hooks.beforeBatch; f.sqlite.exec(sql); } };
    await assert.rejects(f.apply, status(401, 403, 409));
    assert.equal(f.row().state, original); assert.equal(f.auditCount(), 0);
  } finally { f.sqlite.close(); }
});

void test('participant AI receipt failure rolls back game write and pending permissions', async () => {
  const f = await fixture();
  try {
    const before = f.row();
    f.sqlite.exec("CREATE TRIGGER reject_receipt BEFORE INSERT ON admin_seat_ai_operations BEGIN SELECT RAISE(ABORT,'fixture receipt failure'); END;");
    await assert.rejects(f.apply, /fixture receipt failure/); assert.deepEqual(f.row(), before); assert.equal(f.auditCount(), 0);
  } finally { f.sqlite.close(); }
});

for (const different of [false, true]) void test(`racing ${different ? 'conflicting' : 'identical'} participant request retains one operation`, async () => {
  const f = await fixture();
  try {
    const barrier = pauseCommit(f), pending = f.apply(); await barrier.waiting;
    const winner = await f.apply(different ? { ...f.input, difficulty: 'Easy' } : f.input);
    assert.equal(winner.replayed, false); const state = f.row(); barrier.release();
    if (different) await assert.rejects(() => pending, status(409)); else assert.equal((await pending).replayed, true);
    assert.deepEqual(f.row(), state); assert.equal(f.auditCount(), 1);
  } finally { f.sqlite.close(); }
});

void test('viewer reads public participant availability but cannot change it', async () => {
  const f = await fixture('viewer');
  try {
    assert.equal((await readAdminSeatAi(f.database, f.identity, code, now)).players.length, 2);
    const before = f.row(); await assert.rejects(f.apply, status(403)); assert.deepEqual(f.row(), before);
  } finally { f.sqlite.close(); }
});

void test('resume starts a fresh paced continuation only after the administrator enables AI', async () => {
  const f = await fixture();
  try {
    await f.apply(); assert.equal(f.saved().botNextActionAt, 50_000);
    await applyAdminRoomControl(f.database, f.identity, code, { operationId: randomUUID(), expectedRevision: 1, paused: false, joinLocked: false, reason: 'QA resume' }, now);
    assert.equal(f.saved().botsPending, true); assert.equal(f.saved().botNextActionAt, now + 1500);
  } finally { f.sqlite.close(); }
});
