import test from 'node:test';
import assert from 'node:assert/strict';
import { unitStore } from './fixture-nexus-room-store';
import { nexusBgBetrayalFixture } from './fixture-nexus-bg-betrayal';
import { nexusTraitorInventory } from './fixture-nexus-traitors';
import { applyAction, viewGame } from '../game/engine';
import type { RoomsClock } from '../db/rooms';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

void test('SQLite restart preserves private Voice response and exactly one spent BG Nexus card', async (t) => {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom('BG Betrayal SQL', 'beneGesserit', false, []);
  const code = made.view.code;
  const tokens = [made.token];
  for (const faction of ['guild', 'fremen'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  for (const [index, token] of tokens.entries()) {
    const auth = await store.rooms.authenticate(code, token);
    store.sqlite.prepare('UPDATE seats SET player_id = ? WHERE room_code = ? AND player_id = ?')
      .run(['p', 'q', 'r'][index], code, auth.playerId);
  }
  const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  const initial = nexusBgBetrayalFixture();
  initial.code = code;
  initial.version = (await store.rooms.readRoom(code)).version;
  const declared = applyAction(initial, 'p', {
    type: 'voice', kind: 'poison', must: false,
  });
  store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(declared), declared.version, code);
  store.writes.length = 0;
  const action = { type: 'nexusBgBetrayal', event: declared.battle!.event };
  for (const [index, auth] of auths.entries()) {
    const seat = await store.restart().readSeatView(code, auth);
    assert.deepEqual(seat, viewGame(declared, ['p', 'q', 'r'][index]));
    assert.equal(seat.nexusBgBetrayal !== null, index === 2);
    assert.equal('nexusBgBetrayalHistory' in seat, false);
  }
  await assert.rejects(store.rooms.act(code, auths[1], declared.version, action, clock));
  assert.equal(store.writes.length, 0);
  await store.rooms.act(code, auths[2], declared.version, action, clock);
  const committed = await store.restart().readRoom(code);
  assert.equal(committed.version, declared.version + 1);
  assert.equal(committed.battle!.voice, undefined);
  assert.equal(committed.nexusBgBetrayalHistory?.length, 1);
  assert.equal(committed.nexusCards!.cards!.hands.r, null);
  assert.equal(committed.nexusCards!.cards!.discard.filter(card => card === 'beneGesserit').length, 1);
  nexusTraitorInventory(committed);
  const row = store.sqlite.prepare('SELECT state,version FROM rooms WHERE code = ?').get(code);
  await assert.rejects(store.restart().act(code, auths[2], declared.version, action, clock));
  await store.restart().continueRoomAutomatic(code, clock);
  assert.deepEqual(store.sqlite.prepare('SELECT state,version FROM rooms WHERE code = ?').get(code), row);
  for (const [index, auth] of auths.entries()) {
    const seat = await store.restart().readSeatView(code, auth);
    assert.deepEqual(seat, viewGame(committed, ['p', 'q', 'r'][index]));
    assert.equal(seat.nexusBgBetrayal, null);
    assert.equal('nexusBgBetrayalHistory' in seat, false);
  }
});
