import test from 'node:test';
import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { unitStore } from './fixture-nexus-room-store';
import { nexusTraitorFixture, nexusTraitorDraw, nexusTraitorInventory } from './fixture-nexus-traitors';
import { viewGame, type Action, type Game } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
async function fixture(initial = nexusTraitorFixture()) {
  const store = unitStore();
  const made = await store.rooms.createRoom('Traitor SQL', 'harkonnen', false, []);
  const code = made.view.code, tokens = [made.token];
  for (const faction of ['guild', 'fremen'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const ids = ['p', 'q', 'r'];
  for (const [i, token] of tokens.entries()) {
    const auth = await store.rooms.authenticate(code, token);
    store.sqlite.prepare('UPDATE seats SET player_id = ? WHERE room_code = ? AND player_id = ?')
      .run(ids[i], code, auth.playerId);
  }
  const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  initial.code = code; initial.version = (await store.rooms.readRoom(code)).version;
  store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(initial), initial.version, code);
  store.writes.length = 0;
  return { ...store, code, tokens, auths, ids, initial };
}
type Fixture = Awaited<ReturnType<typeof fixture>> & { sqlite: DatabaseSync };
const row = (f: Fixture) => f.sqlite.prepare('SELECT state,version FROM rooms WHERE code = ?').get(f.code);
function draw(g: Game): Action {
  const offer = viewGame(g, 'p').nexusTraitors!.offer!;
  return { type: 'nexusTraitorDraw', event: offer.event, mode: offer.mode };
}
const giveBack = (g: Game, card: string): Action => ({ type: 'nexusTraitorReturn', event: g.nexusTraitorPending, cards: [card] });
async function restored(f: Fixture, g: Game) {
  const before = row(f), rooms = f.restart();
  for (const [i, token] of f.tokens.entries()) {
    const auth = await rooms.authenticate(f.code, token);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, viewGame(g, f.ids[i]));
    if (i && view.nexusTraitors?.pending) assert.deepEqual(view.nexusTraitors.pending.choices, []);
  }
  await rooms.continueRoomAutomatic(f.code, clock);
  assert.deepEqual(row(f), before);
  nexusTraitorInventory(g);
}
void test('Nexus traitor SQL lost draw and return responses restore exact private custody without redrawing or reshuffling', async () => {
  const f = await fixture();
  try {
    const action = draw(f.initial);
    await f.rooms.act(f.code, f.auths[0], f.initial.version, action, clock);
    let g = await f.restart().readRoom(f.code);
    assert.equal(g.players[0].traitors.length, 5);
    await restored(f, g);
    let before = row(f);
    await assert.rejects(f.rooms.act(f.code, f.auths[0], f.initial.version, action, clock));
    await assert.rejects(f.rooms.act(f.code, f.auths[0], g.version, action, clock));
    assert.deepEqual(row(f), before);
    const returned = giveBack(g, g.nexusTraitorExchanges![0].drawn[0]);
    const version = g.version;
    await f.rooms.act(f.code, f.auths[0], version, returned, clock);
    g = await f.restart().readRoom(f.code); before = row(f);
    assert.equal(g.players[0].traitors.length, 4);
    assert.equal(g.nexusTraitorExchanges![0].stage, 'complete');
    await restored(f, g);
    await assert.rejects(f.rooms.act(f.code, f.auths[0], version, returned, clock));
    await assert.rejects(f.rooms.act(f.code, f.auths[0], g.version, returned, clock));
    assert.deepEqual(row(f), before);
  } finally { f.sqlite.close(); }
});
void test('Nexus traitor SQL competing returns commit one selection and one shuffle while preserving unrelated rooms', async () => {
  const f = await fixture(nexusTraitorDraw(nexusTraitorFixture()));
  try {
    const other = await f.rooms.createRoom('Unrelated', 'atreides', false, []);
    const unrelated = f.sqlite.prepare('SELECT state,version FROM rooms WHERE code = ?').get(other.view.code);
    f.writes.length = 0;
    let arrivals = 0; let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
    const results = await Promise.allSettled(f.initial.players[0].traitors.slice(0, 2).map(card =>
      f.restart().act(f.code, f.auths[0], f.initial.version, giveBack(f.initial, card), clock)));
    delete f.hooks.beforeWrite;
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.deepEqual(f.writes.map(write => write.changes).sort((a, b) => a - b), [0, 1]);
    const g = await f.rooms.readRoom(f.code);
    assert.equal(g.version, f.initial.version + 1);
    assert.equal(g.nexusTraitorExchanges!.length, 1);
    assert.equal(g.nexusTraitorExchanges![0].returned.length, 1);
    await restored(f, g);
    assert.deepEqual(f.sqlite.prepare('SELECT state,version FROM rooms WHERE code = ?').get(other.view.code), unrelated);
  } finally { f.sqlite.close(); }
});
void test('Nexus traitor SQL rejects lost preceding-decision evidence before reads or writes', async () => {
  const f = await fixture(nexusTraitorDraw(nexusTraitorFixture()));
  try {
    for (const damage of [
      (g: Game) => { g.nexusTraitorParent = null; },
      (g: Game) => { g.ready.push('q'); },
      (g: Game) => { g.nexusTraitorExchanges![0].drawn[0] = 'missing'; },
    ]) {
      const bad = structuredClone(f.initial); damage(bad);
      f.sqlite.prepare('UPDATE rooms SET state = ? WHERE code = ?').run(JSON.stringify(bad), f.code);
      f.writes.length = 0; const before = row(f);
      await assert.rejects(f.restart().readSeatView(f.code, f.auths[0]));
      await assert.rejects(f.restart().act(f.code, f.auths[0], bad.version, giveBack(f.initial, f.initial.players[0].traitors[0]), clock));
      await f.restart().continueRoomAutomatic(f.code, clock);
      assert.deepEqual(row(f), before);
      assert.equal(f.writes.length, 0);
    }
  } finally { f.sqlite.close(); }
});
