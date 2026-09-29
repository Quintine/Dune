import test from 'node:test';
import assert from 'node:assert/strict';
import type { RoomsClock } from '../db/rooms';
import { nexusPlayer } from './fixture-nexus-cards';
import { fremenBetrayalFixture, fremenBetrayalMovement } from './fixture-nexus-fremen-betrayal';
import { unitStore } from './fixture-nexus-room-store';

const clock: RoomsClock = { now: () => 45000, sleep: async () => {} };

void test('concurrent authenticated Fremen Betrayal commits one physical card and restores the turn-long range limit', async t => {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const created = await store.rooms.createRoom('Fremen SQL', 'fremen', false, []);
  const code = created.view.code;
  const atreides = await store.rooms.joinRoom(code, 'Atreides', 'atreides');
  const harkonnen = await store.rooms.joinRoom(code, 'Harkonnen', 'harkonnen');
  const tokens = [created.token, atreides.token!, harkonnen.token!];
  const auth = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  const [fremen, ally, holder] = auth.map(seat => seat.playerId) as [string, string, string];
  const { g, play } = fremenBetrayalFixture(false, [fremen, ally, holder]);
  g.code = code;
  g.version = (await store.rooms.readRoom(code)).version;
  store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(g), g.version, code);
  store.writes.length = 0;

  const before = store.sqlite.prepare('SELECT state, version FROM rooms WHERE code = ?').get(code);
  const rivalView = await store.rooms.readSeatView(code, auth[1]);
  assert.equal(rivalView.nexusFremenBetrayal, null);
  assert.equal(rivalView.nexusCards?.card, null);
  const results = await Promise.allSettled([
    store.restart().act(code, auth[2], g.version, play, clock),
    store.restart().act(code, auth[2], g.version, play, clock),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.notDeepEqual(store.sqlite.prepare('SELECT state, version FROM rooms WHERE code = ?').get(code), before);
  const saved = await store.restart().readRoom(code);
  assert.equal(saved.nexusCards!.cards!.hands[holder], null);
  assert.equal(saved.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
  assert.equal(saved.nexusFremenBetrayalHistory?.length, 1);
  assert.equal(nexusPlayer(saved, fremen).fremenNexusMovementBlockedTurn, saved.turn);
  const freshAuth = await store.restart().authenticate(code, tokens[0]);
  const view = await store.restart().readSeatView(code, freshAuth);
  assert.equal(view.players.find(player => player.id === fremen)!.fremenMovementBlocked, true);
  assert.equal(view.nexusFremenBetrayal, null);
  const stable = store.sqlite.prepare('SELECT state, version FROM rooms WHERE code = ?').get(code);
  await assert.rejects(store.restart().act(code, freshAuth, saved.version, fremenBetrayalMovement(2), clock));
  await assert.rejects(store.restart().act(code, auth[2], saved.version, play, clock));
  assert.deepEqual(store.sqlite.prepare('SELECT state, version FROM rooms WHERE code = ?').get(code), stable);
});
