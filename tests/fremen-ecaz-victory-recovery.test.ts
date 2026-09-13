import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { viewGame, type Game } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import { fremenEcazFinalTurn, fremenEcazCustody } from './fixture-fremen-ecaz-victory';

const clock: RoomsClock = { now: () => 42000, sleep: async () => {} };
const savedRows = (sqlite: DatabaseSync) => sqlite.prepare('SELECT state, version FROM rooms').all();
async function fixture(t: test.TestContext) {
  const store = unitStore(); t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom('Ecaz victory QA', 'ecaz', false, ['ecaz']);
  const code = made.view.code, tokens = [made.token];
  for (const faction of ['fremen', 'guild', 'beneGesserit'] as const) tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const auths = await Promise.all(tokens.map((token) => store.rooms.authenticate(code, token)));
  const g = fremenEcazFinalTurn(true, auths.map((a) => a.playerId));
  g.code = code; g.version = (await store.rooms.readRoom(code)).version;
  store.sqlite.prepare('UPDATE rooms SET state=?, version=? WHERE code=?').run(JSON.stringify(g), g.version, code);
  for (const auth of auths.slice(0, -1)) {
    const current = await store.rooms.readRoom(code);
    await store.rooms.act(code, auth, current.version, { type: 'ready' }, clock);
  }
  const pending = await store.rooms.readRoom(code);
  assert.equal(pending.phase, 7); assert.equal(pending.status, 'playing');
  store.writes.length = 0;
  return { ...store, code, tokens, auths, pending };
}

void test('restored final readiness awards the same allied win once and preserves private seats and physical custody', async (t) => {
  const f = await fixture(t), before = savedRows(f.sqlite);
  const seatRows = f.sqlite.prepare('SELECT * FROM seats').all();
  for (const [i, token] of f.tokens.entries()) {
    const rooms = f.restart(), auth = await rooms.authenticate(f.code, token);
    assert.deepEqual(await rooms.readSeatView(f.code, auth), viewGame(f.pending, f.auths[i].playerId));
  }
  assert.deepEqual(savedRows(f.sqlite), before);
  const rooms = f.restart(), auth = await rooms.authenticate(f.code, f.tokens[3]);
  await rooms.act(f.code, auth, f.pending.version, { type: 'ready' }, clock);
  const done = await f.restart().readRoom(f.code);
  assert.equal(done.status, 'finished');
  assert.deepEqual(done.winner, [f.auths[1].playerId, f.auths[0].playerId]);
  assert.deepEqual(fremenEcazCustody(done), fremenEcazCustody(f.pending));
  assert.equal(done.log.filter((entry) => entry.text.includes('Fremen special victory')).length, 1);
  const resolvedRows = savedRows(f.sqlite);
  for (const [i, token] of f.tokens.entries()) {
    const restored = f.restart(), seat = await restored.authenticate(f.code, token);
    const view = await restored.readSeatView(f.code, seat);
    assert.deepEqual(view, viewGame(done, f.auths[i].playerId));
    assert.deepEqual(viewGame(JSON.parse(JSON.stringify(done)) as Game, seat.playerId), view);
    for (const rival of view.players.filter((p) => p.id !== seat.playerId))
      for (const key of ['hand', 'traitors', 'spice', 'prediction']) assert.equal(key in rival, false);
  }
  await f.restart().continueRoomAutomatic(f.code, clock);
  await assert.rejects(f.restart().act(f.code, auth, f.pending.version, { type: 'ready' }, clock));
  await assert.rejects(f.restart().act(f.code, auth, done.version, { type: 'ready' }, clock));
  assert.deepEqual(savedRows(f.sqlite), resolvedRows);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), seatRows);
});

void test('competing final-readiness writes cannot duplicate victory settlement', async (t) => {
  const f = await fixture(t);
  let entered = 0; let release!: () => void;
  const both = new Promise<void>((resolve) => { release = resolve; });
  f.hooks.beforeWrite = async () => { if (++entered === 2) release(); await both; };
  const results = await Promise.allSettled([0, 1].map(() => f.rooms.act(f.code, f.auths[3], f.pending.version, { type: 'ready' }, clock)));
  f.hooks.beforeWrite = undefined;
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.deepEqual(f.writes.map((w) => w.changes).sort((a, b) => a - b), [0, 1]);
  const done = await f.restart().readRoom(f.code);
  assert.equal(done.version, f.pending.version + 1);
  assert.equal(done.log.filter((entry) => entry.text.includes('Fremen special victory')).length, 1);
  assert.deepEqual(fremenEcazCustody(done), fremenEcazCustody(f.pending));
});
