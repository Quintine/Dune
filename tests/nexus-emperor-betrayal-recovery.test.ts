import test from 'node:test';
import assert from 'node:assert/strict';
import { unitStore } from './fixture-nexus-room-store';
import { nexusSardaukarFixture, nexusSardaukarInventory } from './fixture-nexus-sardaukar';
import { viewGame } from '../game/engine';
import type { RoomsClock } from '../db/rooms';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

void test('SQLite restart, seat privacy and lost acknowledgment preserve exactly one Emperor Betrayal', async (t) => {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom('Emperor Betrayal SQL', 'emperor', true, []);
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
  const g = nexusSardaukarFixture({ starred: 2, normal: 3, emperorCardHolder: 'r' });
  g.code = code;
  g.version = (await store.rooms.readRoom(code)).version;
  store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(g), g.version, code);
  store.writes.length = 0;
  const action = { type: 'nexusEmperorBetrayal', event: g.battle!.event };
  for (const [index, auth] of auths.entries()) {
    const view = await store.restart().readSeatView(code, auth);
    assert.deepEqual(view, viewGame(g, ['p', 'q', 'r'][index]));
    assert.equal(view.nexusEmperorBetrayal !== null, index === 2);
    assert.equal('nexusEmperorBetrayalHistory' in view, false);
  }
  await assert.rejects(store.rooms.act(code, auths[1], g.version, action, clock));
  assert.equal(store.writes.length, 0);
  await store.rooms.act(code, auths[2], g.version, action, clock);
  const committed = await store.restart().readRoom(code);
  assert.equal(committed.version, g.version + 1);
  assert.equal(committed.nexusEmperorBetrayalHistory?.length, 1);
  assert.ok(committed.battle!.eliteBlocked?.includes('p'));
  assert.equal(committed.nexusCards!.cards!.hands.r, null);
  assert.equal(committed.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, 1);
  nexusSardaukarInventory(committed);
  const row = store.sqlite.prepare('SELECT state,version FROM rooms WHERE code = ?').get(code);
  await assert.rejects(store.restart().act(code, auths[2], g.version, action, clock));
  await store.restart().continueRoomAutomatic(code, clock);
  assert.deepEqual(store.sqlite.prepare('SELECT state,version FROM rooms WHERE code = ?').get(code), row);
  for (const [index, auth] of auths.entries()) {
    const view = await store.restart().readSeatView(code, auth);
    assert.deepEqual(view, viewGame(committed, ['p', 'q', 'r'][index]));
    assert.equal(view.nexusEmperorBetrayal, null);
    assert.equal('nexusEmperorBetrayalHistory' in view, false);
  }
});
