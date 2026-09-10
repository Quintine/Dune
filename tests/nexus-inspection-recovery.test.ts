import test from 'node:test';
import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { unitStore } from './fixture-nexus-room-store';
import { nexusInspectionFixture, inspectionNative, inspectionHold } from './fixture-nexus-inspection';
import { nexusInventory, nexusPlayer } from './fixture-nexus-cards';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
async function fixture(initial = inspectionNative(nexusInspectionFixture())) {
  const store = unitStore();
  const made = await store.rooms.createRoom('Inspection SQL', 'fremen', false, []);
  const code = made.view.code, tokens = [made.token];
  for (const faction of ['atreides', 'harkonnen'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const ids = ['f', 'a', 'h'];
  // The game was initialized with its final identities. Bind disposable test
  // sessions to those seats; never rewrite identifiers inside signed histories.
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
const play = (g: Game, field: string): Action => ({ type: 'nexusAtreides', event: g.battle!.event, mode: 'cunning', field });
async function restored(f: Fixture, g: Game) {
  const before = row(f), rooms = f.restart();
  for (const [i, token] of f.tokens.entries()) {
    const auth = await rooms.authenticate(f.code, token);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, viewGame(g, f.ids[i]));
    if (i === 0) assert.deepEqual(view.battle!.nexusInsights, []);
  }
  await rooms.continueRoomAutomatic(f.code, clock);
  assert.deepEqual(row(f), before);
  nexusInventory(g);
}
async function race(f: Fixture, inputs: { seat: number; action: Action }[]) {
  let arrivals = 0; let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  f.hooks.beforeWrite = async () => { if (++arrivals === inputs.length) release(); await gate; };
  const results = await Promise.allSettled(inputs.map(({seat, action}) =>
    f.restart().act(f.code, f.auths[seat], f.initial.version, action, clock)));
  delete f.hooks.beforeWrite;
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.deepEqual(f.writes.map(w => w.changes).sort((a,b) => a-b), [0,1]);
  return f.rooms.readRoom(f.code);
}
void test('Nexus inspection SQL competing second-field declarations consume exactly one card and survive module reload', async () => {
  const f = await fixture();
  try {
    const g = await race(f, [{seat:1,action:play(f.initial,'weapon')},{seat:1,action:play(f.initial,'defense')}]);
    assert.equal(g.version, f.initial.version + 1);
    assert.equal(g.battle!.nexusInspection!.stage, 'answer');
    assert.deepEqual(g.battle!.prescience, f.initial.battle!.prescience);
    assert.equal(g.nexusCards!.cards!.discard.filter(c => c === 'atreides').length, 1);
    const before = row(f);
    await assert.rejects(f.rooms.act(f.code, f.auths[1], g.version, play(g,'leader'),clock));
    assert.deepEqual(row(f),before);
    await restored(f,g);
  } finally { f.sqlite.close(); }
});
void test('Nexus inspection SQL lost answer response restores both commitments and rejects stale or duplicate disclosures', async () => {
  let initial = inspectionNative(nexusInspectionFixture());
  const weapon = inspectionHold(initial,'h','projectile');
  initial = applyAction(initial,'a',play(initial,'weapon'));
  const f = await fixture(initial);
  try {
    const action: Action = {type:'nexusPrescienceAnswer',event:initial.battle!.event,value:weapon.id};
    await f.rooms.act(f.code,f.auths[2],initial.version,action,clock);
    const g = await f.restart().readRoom(f.code), before = row(f);
    assert.deepEqual(g.battle!.nexusInspection!.answers,[weapon.id]);
    assert.equal(viewGame(g,'h').battle!.ownCommitments.length,2);
    await assert.rejects(f.rooms.act(f.code,f.auths[2],initial.version,action,clock));
    await assert.rejects(f.rooms.act(f.code,f.auths[2],g.version,action,clock));
    assert.deepEqual(row(f),before);
    await restored(f,g);
    const damaged = structuredClone(g); damaged.battle!.nexusInspection!.answers[0] = null;
    f.sqlite.prepare('UPDATE rooms SET state = ? WHERE code = ?').run(JSON.stringify(damaged), f.code);
    f.writes.length = 0;
    await assert.rejects(f.restart().readSeatView(f.code,f.auths[2]));
    await assert.rejects(f.restart().act(f.code,f.auths[2],g.version,action,clock));
    // No automatic continuation is scheduled at this owned decision. The
    // scheduler leaves it untouched; authenticated reads/actions reject it.
    await f.restart().continueRoomAutomatic(f.code,clock);
    assert.equal(f.writes.length,0);
  } finally { f.sqlite.close(); }
});
void test('Nexus inspection SQL concurrent Karamas cancel one extra attempt and charge only its accepted responder', async () => {
  let initial = inspectionNative(nexusInspectionFixture());
  const cards = ['f','h'].map(id => {
    const index = initial.deck.findIndex(c => c.effect === 'karama'); assert.ok(index >= 0);
    const card = initial.deck.splice(index,1)[0]; nexusPlayer(initial,id).hand.push(card); return card;
  });
  initial = applyAction(initial,'a',play(initial,'weapon'));
  const f = await fixture(initial);
  try {
    const g = await race(f,cards.map((card,i) => ({seat:i===0?0:2,action:{type:'card',card:card.id,mode:'cancel'}})));
    assert.equal(g.battle!.nexusInspection!.stage,'canceled');
    assert.equal(g.battle!.prescience!.value,0);
    assert.equal(cards.filter(card => g.players.some(p => p.hand.some(c => c.id === card.id))).length,1);
    assert.deepEqual(g.battle!.nexusInspection!.answers,[]);
    await restored(f,g);
  } finally { f.sqlite.close(); }
});
