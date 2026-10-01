import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { adminStore, pauseAdminBatch } from './admin-access-fixture';
import { adminLogin, requireAdmin, adminLogoutAll, AdminError } from '../db/admin-access';
import { projectAdminRoom, readAdminDirectory } from '../db/admin-directory';
import { applyAction, viewGame } from '../game/engine';
import { tableActionOwner } from '../game/table-turn';
import { createIxianNexusBetrayalFixture } from './fixture-nexus-ixian-betrayal';

const state = (name = 'Directory QA', status = 'lobby', advanced = false) => ({
  status, advanced, host: 'p1', turn: 1, phase: 0, expansions: [],
  players: [{ id: 'p1', name, faction: 'atreides', ready: false, hand: ['SECRET_HAND'], traitors: ['SECRET_TRAITOR'], prediction: 'SECRET_PREDICTION', spice: 17 }],
  battle: null, response: null, decision: null, active: 'p1',
  log: ['SECRET_HISTORY'], unknownFuturePrivateField: 'SECRET_NEW_FIELD',
});
const insert = (sqlite: DatabaseSync, code: string, value: unknown, updated = 100) => sqlite.prepare('INSERT INTO rooms (code,state,version,updated_at) VALUES (?,?,0,?)').run(code, typeof value === 'string' ? value : JSON.stringify(value), updated);

void test('recoverably removed rooms leave the default directory and remain explicitly searchable for restoration', async () => {
  const f = await fixture();
  try {
    insert(f.sqlite, 'ACTIVEAA', state('Active QA'));
    insert(f.sqlite, 'REMOVEDA', state('Removed QA'));
    f.sqlite.prepare('INSERT INTO room_removals(room_code,removed,revision,removed_at,updated_at) VALUES (?,1,1,100,100)').run('REMOVEDA');
    const read = (query = '') => readAdminDirectory(f.database, f.identity, new URLSearchParams(query));
    const active = await read(); assert.equal(active.total, 1); assert.equal(active.rooms[0].code, 'ACTIVEAA'); assert.equal(active.rooms[0].removed, false);
    assert.equal((await read('q=Removed')).total, 0);
    const removed = await read('removal=removed&q=Removed'); assert.equal(removed.total, 1); assert.equal(removed.rooms[0].removed, true);
    assert.equal(JSON.stringify(removed).includes('SECRET'), false);
    assert.equal((await read('removal=all')).total, 2);
    await assert.rejects(read('removal=invalid'), (e: unknown) => e instanceof AdminError && e.status === 400);
    f.sqlite.prepare('UPDATE room_removals SET removed=0,revision=2,removed_at=NULL WHERE room_code=?').run('REMOVEDA');
    assert.equal((await read()).total, 2); assert.equal((await read('removal=removed')).total, 0);
  } finally { f.sqlite.close(); }
});
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

const project = (value: unknown) => projectAdminRoom({ code: 'IXADMINA', version: 3, updated_at: 100, state: JSON.stringify(value) });

void test('directory ownership follows genuine shared and sole Ixian acknowledgements instead of the native bidder', () => {
  for (const kind of ['technology', 'bidding'] as const) {
    const f = createIxianNexusBetrayalFixture({ kind, receiverCount: 2 });
    assert.equal(f.required.length, 2);
    const shared = project(f.game);
    assert.deepEqual(shared.pending.owners, []);
    for (const player of f.game.players) assert.equal(tableActionOwner(viewGame(f.game, player.id)), null);
    const partial = applyAction(f.game, f.holder, { type: 'nexusIxianBetrayalPass', event: f.event });
    const remaining = f.required.find(id => id !== f.holder)!;
    const sole = project(partial);
    assert.deepEqual(sole.pending.owners, [remaining]);
    assert.notEqual(remaining, f.provider);
    for (const player of partial.players) assert.equal(tableActionOwner(viewGame(partial, player.id)), remaining);
    assert.equal(sole.pending.label, shared.pending.label, 'Passing does not reveal which private card can prevent the attempt.');

    const privateChanges = {
      ...partial,
      players: partial.players.map(player => ({ ...player, hand: ['SECRET_HAND'], spice: 'SECRET_PRICE' })),
      auction: partial.auction && { ...partial.auction, price: 'SECRET_PRICE' },
      pendingNexusIxianBetrayal: {
        ...partial.pendingNexusIxianBetrayal,
        source: { eligible: 'SECRET_ELIGIBILITY', nativeContext: 'SECRET_NATIVE', parent: 'SECRET_PARENT', card: 'SECRET_SOURCE_CARD' },
      },
    };
    assert.deepEqual(project(privateChanges), sole, 'Admin metadata depends on public membership, not private source validity or custody.');
    assert.equal(JSON.stringify(sole).includes('SECRET'), false);
  }
});

void test('an irrelevant held Nexus face has the same admin acknowledgement metadata as an eligible face', () => {
  for (const kind of ['technology', 'bidding'] as const) {
    const eligible = createIxianNexusBetrayalFixture({ kind, receiverCount: 2, face: 'ixians', secondFace: 'guild' });
    const irrelevant = createIxianNexusBetrayalFixture({ kind, receiverCount: 2, face: 'richese', secondFace: 'guild' });
    assert.equal(viewGame(eligible.game, eligible.holder).nexusIxianBetrayalReaction!.canUse, true);
    assert.equal(viewGame(irrelevant.game, irrelevant.holder).nexusIxianBetrayalReaction!.canUse, false);
    assert.deepEqual(project(eligible.game), project(irrelevant.game));
    const eligiblePartial = applyAction(eligible.game, eligible.holder, { type: 'nexusIxianBetrayalPass', event: eligible.event });
    const irrelevantPartial = applyAction(irrelevant.game, irrelevant.holder, { type: 'nexusIxianBetrayalPass', event: irrelevant.event });
    assert.deepEqual(project(eligiblePartial), project(irrelevantPartial));
  }
});

void test('Ixian admin acknowledgements preserve lifecycle and higher public pending priorities', () => {
  const input = {
    ...state('Priority QA', 'playing'), phase: 3,
    pendingNexusIxianBetrayal: { required: ['p1'], passed: [], source: 'SECRET_SOURCE' },
    auction: { active: 'p1', price: 'SECRET_PRICE' },
  };
  const higherPriority = [
    { status: 'finished' }, { status: 'lobby' }, { status: 'setup' },
    { pendingTreacheryDiscard: { card: 'SECRET_CARD' } },
    { response: { kind: 'SECRET_RESPONSE' } }, { phaseOpening: { passed: [] } },
    { truthtrance: { question: 'SECRET_QUESTION' } },
    { decision: { player: 'p1', card: 'SECRET_CARD' } },
    { battle: { attacker: 'p1', defender: 'UNSEATED_SECRET' } },
    { nexus: true },
    { phase: 0, stormDialers: ['p1'], stormDials: {} },
  ];
  for (const priority of higherPriority) {
    const value = { ...input, ...priority };
    const withGate = project(value);
    const withoutGate = project({ ...value, pendingNexusIxianBetrayal: null });
    assert.deepEqual(withGate, withoutGate);
    assert.equal(JSON.stringify(withGate).includes('SECRET'), false);
  }
});

void test('malformed or orphan Ixian membership cannot disclose an unseated owner or fall through to the bidder', () => {
  const input = { ...state('Membership QA', 'playing'), phase: 3, auction: { active: 'p1' } };
  for (const membership of [
    { required: ['UNSEATED_SECRET'], passed: [] },
    { required: [null, 17, { id: 'SECRET_OBJECT' }], passed: [] },
    { required: [], passed: [] },
    { required: ['p1'], passed: ['p1'] },
    { required: 'SECRET_REQUIRED', passed: [] },
    { required: ['p1'], passed: 'SECRET_PASSED' },
    {},
  ]) {
    const output = project({ ...input, pendingNexusIxianBetrayal: { ...membership, source: 'SECRET_SOURCE' } });
    assert.deepEqual(output.pending.owners, []);
    assert.equal(output.status, 'playing', 'Malformed optional membership does not hide otherwise readable public room metadata.');
    assert.equal(JSON.stringify(output).includes('SECRET'), false);
  }
  const duplicate = project({ ...input, pendingNexusIxianBetrayal: { required: ['p1', 'p1', 'UNSEATED_SECRET'], passed: [] } });
  assert.deepEqual(duplicate.pending.owners, ['p1']);
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

void test('closed rooms remain in the directory but are excluded from running rooms and expose only the closure flag', async () => {
  const f = await fixture();
  try {
    insert(f.sqlite, 'OPENROOM', state()); insert(f.sqlite, 'CLOSEDQA', state());
    f.sqlite.prepare('INSERT INTO room_closures(room_code,closed,revision,closed_at,updated_at) VALUES (?,1,1,100,100)').run('CLOSEDQA');
    const read = (q: string) => readAdminDirectory(f.database, f.identity, new URLSearchParams(q));
    assert.equal((await read('')).total, 2);
    const closed = await read('availability=closed');
    assert.equal(closed.total, 1); assert.equal(closed.rooms[0].code, 'CLOSEDQA');
    assert.deepEqual(closed.rooms[0].control, { paused: false, joinLocked: false, revision: 0, updatedAt: null, closed: true });
    assert.equal(JSON.stringify(closed).includes('SECRET'), false);
    assert.deepEqual((await read('availability=running')).rooms.map(room => room.code), ['OPENROOM']);
  } finally { f.sqlite.close(); }
});

void test('archive filters compose with removal, availability, private-safe search and stable pagination', async () => {
  const f = await fixture();
  try {
    insert(f.sqlite, 'OPENROOM', state('Open QA'));
    for (let n = 0; n < 28; n++) {
      const code = `AR${String(n).padStart(6, '0')}`;
      insert(f.sqlite, code, state(n === 0 ? 'Archived %_ QA' : 'Archived QA'));
      f.sqlite.prepare('INSERT INTO room_closures(room_code,closed,revision,closed_at,updated_at) VALUES (?,1,1,100,100)').run(code);
      f.sqlite.prepare('INSERT INTO room_archives(room_code,archived,revision,archived_at,updated_at) VALUES (?,1,1,100,100)').run(code);
      if (n === 27) f.sqlite.prepare('INSERT INTO room_removals(room_code,removed,revision,removed_at,updated_at) VALUES (?,1,1,100,100)').run(code);
    }
    const read = (q = '') => readAdminDirectory(f.database, f.identity, new URLSearchParams(q));
    assert.deepEqual((await read()).rooms.map(room => room.code), ['OPENROOM']);
    assert.equal((await read('q=Archived')).total, 0);
    const first = await read('archive=archived'), second = await read('archive=archived&page=2');
    assert.equal(first.total, 27); assert.equal(first.rooms.length, 25); assert.equal(second.rooms.length, 2);
    assert.equal(new Set([...first.rooms, ...second.rooms].map(room => room.code)).size, 27);
    assert.ok(first.rooms.every(room => room.archived && room.control.closed && !room.removed));
    assert.equal(JSON.stringify(first).includes('SECRET'), false);
    assert.equal((await read('archive=all')).total, 28);
    assert.equal((await read('removal=all')).total, 1);
    assert.equal((await read('removal=removed')).total, 0);
    assert.equal((await read('archive=all&removal=all')).total, 29);
    assert.equal((await read('archive=archived&removal=removed')).total, 1);
    assert.equal((await read('archive=archived&availability=closed')).total, 27);
    assert.equal((await read('archive=all&availability=running')).total, 1);
    assert.equal((await read('archive=archived&q=%25_')).total, 1);
    assert.equal((await read('archive=all&q=SECRET')).total, 0);
    for (const q of ['archive=unknown', 'archive=all&archive=archived']) await assert.rejects(read(q), (e: unknown) => e instanceof AdminError && e.status === 400);
  } finally { f.sqlite.close(); }
});
