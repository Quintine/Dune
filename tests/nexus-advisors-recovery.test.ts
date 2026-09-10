import test from 'node:test';
import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { unitStore } from './fixture-nexus-room-store';
import { nexusAdvisorFixture, holdAdvisorKarama } from './fixture-nexus-advisors';
import { nexusTraitorInventory } from './fixture-nexus-traitors';
import { viewGame, type Action, type Game } from '../game/engine';
import type { RoomsClock } from '../db/rooms';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
async function fixture(initial: Game) {
  const store = unitStore();
  const made = await store.rooms.createRoom(
    'Cunning SQL',
    'harkonnen',
    false,
    [],
  );
  const code = made.view.code,
    tokens = [made.token];
  for (const faction of ['guild', 'fremen'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const ids = ['p', 'q', 'r'];
  // Only disposable SQL seat bindings move. Existing game identities and their
  // signed battle/component histories remain untouched.
  for (const [i, token] of tokens.entries()) {
    const auth = await store.rooms.authenticate(code, token);
    store.sqlite
      .prepare(
        'UPDATE seats SET player_id = ? WHERE room_code = ? AND player_id = ?',
      )
      .run(ids[i], code, auth.playerId);
  }
  const auths = await Promise.all(
    tokens.map((token) => store.rooms.authenticate(code, token)),
  );
  initial.code = code;
  initial.version = (await store.rooms.readRoom(code)).version;
  store.sqlite
    .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(initial), initial.version, code);
  store.writes.length = 0;
  return { ...store, code, tokens, auths, ids, initial };
}
type Fixture = Awaited<ReturnType<typeof fixture>> & { sqlite: DatabaseSync };
const row = (f: Fixture) =>
  f.sqlite
    .prepare('SELECT state,version FROM rooms WHERE code = ?')
    .get(f.code);
const advisorAction = (g: Game): Action => ({
  type: 'nexusAdvisors', event: viewGame(g, 'p').nexusAdvisors!.offer!.event,
  territories: ['arrakeen', 'pasty_mesa'],
});
async function restored(f: Fixture, g: Game) {
  const before = row(f),
    rooms = f.restart();
  for (const [i, token] of f.tokens.entries()) {
    const auth = await rooms.authenticate(f.code, token);
    const actual = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(actual, viewGame(g, f.ids[i]));
    assert.equal(Object.hasOwn(actual, 'nexusAdvisorHistory'), false);
  }
  await rooms.continueRoomAutomatic(f.code, clock);
  assert.deepEqual(row(f), before);
  nexusTraitorInventory(g);
}
async function compete(f: Fixture, action: Action) {
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await gate;
  };
  const results = await Promise.allSettled(
    [f.restart(), f.restart()].map((rooms) =>
      rooms.act(f.code, f.auths[0], f.initial.version, action, clock),
    ),
  );
  delete f.hooks.beforeWrite;
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.deepEqual(
    f.writes.map((w) => w.changes).sort((a, b) => a - b),
    [0, 1],
  );
  const g = await f.restart().readRoom(f.code);
  assert.equal(g.version, f.initial.version + 1);
  return g;
}

void test('SQLite competing advisor declarations save exactly one pending batch and private seats restore it', async () => {
  const initial = nexusAdvisorFixture();
  holdAdvisorKarama(initial);
  const f = await fixture(initial);
  try {
    const action = advisorAction(f.initial);
    const g = await compete(f, action);
    assert.equal(g.response?.kind, 'nexusAdvisorFlip');
    assert.equal(g.nexusAdvisorHistory!.length, 1);
    assert.equal(g.nexusAdvisorLast!.stage, 'pending');
    assert.deepEqual(g.players[0].advisors, initial.players[0].advisors);
    await restored(f, g);
    const before = row(f);
    await assert.rejects(f.rooms.act(f.code, f.auths[0], initial.version, action, clock));
    await assert.rejects(f.rooms.act(f.code, f.auths[0], g.version, action, clock));
    assert.deepEqual(row(f), before);
    await f.restart().act(f.code, f.auths[1], g.version, {type:'passResponse'}, clock);
    const settled = await f.restart().readRoom(f.code);
    assert.equal(settled.nexusAdvisorLast!.stage, 'completed');
    assert.deepEqual(settled.players[0].advisors, {carthag:{}});
    assert.deepEqual(settled.players[0].forces, initial.players[0].forces);
    await restored(f, settled);
  } finally { f.sqlite.close(); }
});

void test('SQLite reconnect then Karama cancels the entire saved advisor batch without spending movement', async () => {
  const initial = nexusAdvisorFixture();
  const karama = holdAdvisorKarama(initial);
  const f = await fixture(initial);
  try {
    await f.rooms.act(f.code, f.auths[0], initial.version, advisorAction(initial), clock);
    const pending = await f.restart().readRoom(f.code);
    await restored(f, pending);
    await f.restart().act(f.code, f.auths[1], pending.version, {type:'card',card:karama,mode:'cancel'}, clock);
    const g = await f.restart().readRoom(f.code);
    assert.equal(g.nexusAdvisorLast!.stage, 'canceled');
    assert.deepEqual(g.players[0].advisors, initial.players[0].advisors);
    assert.deepEqual(g.players[0].forces, initial.players[0].forces);
    assert.equal(g.players[0].moved, 0);
    assert.equal(g.players[0].shipped, false);
    assert.equal(g.discard.filter(c => c.id === karama).length, 1);
    await restored(f, g);
    const before = row(f);
    await assert.rejects(f.rooms.act(f.code, f.auths[1], g.version, {type:'card',card:karama,mode:'cancel'}, clock));
    assert.deepEqual(row(f), before);
  } finally { f.sqlite.close(); }
});

void test('SQLite rejects missing or corrupted advisor continuations without changing their saved rows', async () => {
  const initial = nexusAdvisorFixture(); holdAdvisorKarama(initial);
  const f = await fixture(initial);
  try {
    await f.rooms.act(f.code, f.auths[0], initial.version, advisorAction(initial), clock);
    const good = await f.rooms.readRoom(f.code);
    const changes: ((g:Game)=>void)[] = [
      g => { delete g.nexusAdvisorHistory; },
      g => { delete g.nexusAdvisorLast; },
      g => { g.nexusAdvisorHistory![0].receipt.selections.pop(); },
      g => { g.response!.intent += '-stale'; },
      g => { g.response = null; },
      g => { g.players[0].moved++; },
      g => { g.players[0].forces['pasty_mesa:5']++; g.players[0].reserves--; },
      g => { g.nexusAdvisorHistory![0].stage = 'completed'; },
    ];
    for (const change of changes) {
      const bad = structuredClone(good); change(bad);
      f.sqlite.prepare('UPDATE rooms SET state = ? WHERE code = ?').run(JSON.stringify(bad), f.code);
      f.writes.length = 0;
      const before = row(f);
      for (const auth of f.auths) await assert.rejects(f.restart().readSeatView(f.code, auth));
      await assert.rejects(f.restart().act(f.code, f.auths[1], bad.version, {type:'passResponse'}, clock));
      assert.deepEqual(row(f), before);
      assert.equal(f.writes.length, 0);
    }
  } finally { f.sqlite.close(); }
});
