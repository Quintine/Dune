import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { adminStore, pauseAdminBatch } from './admin-access-fixture';
import { adminLogin, requireAdmin, adminLogoutAll, AdminError } from '../db/admin-access';
import { projectAdminRoom, readAdminDirectory } from '../db/admin-directory';

const state = (name = 'Directory QA', status = 'lobby', advanced = false) => ({
  status, advanced, host: 'p1', turn: 1, phase: 0, expansions: [],
  players: [{ id: 'p1', name, faction: 'atreides', ready: false, hand: ['SECRET_HAND'], traitors: ['SECRET_TRAITOR'], prediction: 'SECRET_PREDICTION', spice: 17 }],
  battle: null, response: null, decision: null, active: 'p1',
  log: ['SECRET_HISTORY'], unknownFuturePrivateField: 'SECRET_NEW_FIELD',
});
const insert = (sqlite: DatabaseSync, code: string, value: unknown, updated = 100) => sqlite.prepare('INSERT INTO rooms (code,state,version,updated_at) VALUES (?,?,0,?)').run(code, typeof value === 'string' ? value : JSON.stringify(value), updated);
async function fixture() {
  const store = adminStore();
  const account = store.provision('viewer');
  const login = await adminLogin(store.database, account.key);
  const identity = await requireAdmin(store.database, login.token);
  return { ...store, identity, login };
}
void test('admin directory allowlist reveals no private state, role power or seat credential', () => {
  const input = state();
  const output = projectAdminRoom({ code: 'ABCDEFGH', version: 3, updated_at: 100, state: JSON.stringify(input) });
  assert.deepEqual(output.players, [{ id: 'p1', name: 'Directory QA', faction: 'atreides', control: 'human' }]);
  assert.deepEqual(output.pending, { label: 'Lobby readiness', owners: ['p1'] });
  assert.equal(JSON.stringify(output).includes('SECRET'), false);
  assert.deepEqual(Object.keys(output.players[0]).sort(), ['control', 'faction', 'id', 'name']);
  const decision = projectAdminRoom({ code: 'ABCDEFGH', version: 3, updated_at: 100, state: JSON.stringify({ ...input, status: 'playing', decision: { kind: 'capturedLeader', player: 'p1', leader: 'SECRET_CAPTURE', owner: 'SECRET_OWNER' } }) });
  assert.deepEqual(decision.pending, { label: 'Special decision', owners: ['p1'] });
  assert.equal(JSON.stringify(decision).includes('SECRET'), false);
});
void test('admin directory filters, stable pages, literal wildcard search and nested malformed saves', async () => {
  const f = await fixture();
  try {
    for (let n = 0; n < 28; n++) insert(f.sqlite, `QA${String(n).padStart(6, '0')}`, state(n === 0 ? 'Literal %_ QA' : 'Directory QA', n % 2 ? 'playing' : 'lobby', n % 2 === 1));
    insert(f.sqlite, 'BROKEN01', '{bad');
    insert(f.sqlite, 'BROKEN02', { ...state(), players: ['broken'] });
    insert(f.sqlite, 'BROKEN03', { ...state(), players: 'broken' });
    const before = f.sqlite.prepare('SELECT * FROM rooms ORDER BY code').all();
    const read = (query = '') => readAdminDirectory(f.database, f.identity, new URLSearchParams(query));
    const first = await read(), next = await read('page=2');
    assert.equal(first.total, 31); assert.equal(first.rooms.length, 25); assert.equal(next.rooms.length, 6);
    assert.equal(new Set([...first.rooms, ...next.rooms].map(r => r.code)).size, 31);
    assert.equal((await read('q=Directory')).total, 27);
    assert.equal((await read('q=%25_')).total, 1);
    assert.equal((await read('status=playing&rules=advanced')).total, 14);
    assert.equal((await read('status=lobby&rules=advanced')).total, 0);
    assert.equal((await read('q=SECRET')).total, 0, 'Search cannot inspect hands, predictions or history');
    assert.equal((await read('q=BROKEN')).rooms.every(r => r.status === 'unreadable'), true);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM rooms ORDER BY code').all(), before);
    for (const query of ['page=0', 'page=1.5', 'page=-1', 'sort=state', 'status=bogus', 'q=a&q=b', 'x=1', 'q=' + 'a'.repeat(81)]) {
      await assert.rejects(read(query), (e: unknown) => e instanceof AdminError && e.status === 400, query);
    }
  } finally { f.sqlite.close(); }
});
void test('admin directory rechecks authority inside its snapshot after concurrent revocation', async () => {
  const f = await fixture();
  try {
    insert(f.sqlite, 'ABCDEFGH', state());
    const gate = pauseAdminBatch(f);
    const pending = readAdminDirectory(f.database, f.identity, new URLSearchParams());
    await gate.waiting;
    await adminLogoutAll(f.database, f.identity);
    gate.release();
    await assert.rejects(pending, (e: unknown) => e instanceof AdminError && e.status === 401);
  } finally { f.sqlite.close(); }
});

void test('directory projects and filters operational flags without private audit reasons', async () => {
  const f = await fixture();
  try {
    insert(f.sqlite, 'ROOMAAAA', state()); insert(f.sqlite, 'ROOMBBBB', state());
    f.sqlite.prepare('INSERT INTO room_controls(room_code,paused,join_locked,revision,updated_at) VALUES (?,1,1,2,999)').run('ROOMAAAA');
    const read = (query: string) => readAdminDirectory(f.database, f.identity, new URLSearchParams(query));
    const paused = await read('availability=paused');
    assert.equal(paused.total, 1);
    assert.deepEqual(paused.rooms[0].control, { paused: true, joinLocked: true, revision: 2, updatedAt: 999 });
    assert.equal((await read('availability=running')).rooms[0].code, 'ROOMBBBB');
    assert.equal((await read('availability=locked')).rooms[0].code, 'ROOMAAAA');
    await assert.rejects(read('availability=unsupported'), (e: unknown) => e instanceof AdminError && e.status === 400);
  } finally { f.sqlite.close(); }
});
