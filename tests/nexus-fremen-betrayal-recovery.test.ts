import test from 'node:test';
import assert from 'node:assert/strict';
import type { RoomsClock } from '../db/rooms';
import { nexusPlayer } from './fixture-nexus-cards';
import {
  fremenBetrayalFixture, fremenBetrayalMovement,
  fremenBetrayalNextWorm, fremenBetrayalWormFixture,
  useLegacyFremenMovementReceipt,
} from './fixture-nexus-fremen-betrayal';
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
  const legacy = await store.restart().readRoom(code);
  useLegacyFremenMovementReceipt(legacy);
  store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(legacy), legacy.version, code);
  const oldRow = store.sqlite.prepare('SELECT state, version FROM rooms WHERE code = ?').get(code);
  const recoveredView = await store.restart().readSeatView(code, freshAuth);
  assert.equal(recoveredView.players.find(player => player.id === fremen)!.fremenMovementBlocked, true);
  assert.deepEqual(store.sqlite.prepare('SELECT state, version FROM rooms WHERE code = ?').get(code), oldRow);
  await store.restart().act(code, freshAuth, legacy.version, fremenBetrayalMovement(1), clock);
  const progressed = await store.restart().readRoom(code);
  assert.equal(nexusPlayer(progressed, fremen).moved, 1);
});

void test('pre-blow Fremen Betrayal survives concurrent SQL spend and an actual worm without a ride', async t => {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const created = await store.rooms.createRoom('Fremen Worm SQL', 'fremen', false, []);
  const code = created.view.code;
  const atreides = await store.rooms.joinRoom(code, 'Atreides', 'atreides');
  const harkonnen = await store.rooms.joinRoom(code, 'Harkonnen', 'harkonnen');
  const tokens = [created.token, atreides.token!, harkonnen.token!];
  const auth = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  const ids = auth.map(seat => seat.playerId) as [string, string, string];
  const [fremen, , holder] = ids;
  const { g, play } = fremenBetrayalWormFixture(false, ids);
  fremenBetrayalNextWorm(g, 'red_chasm');
  g.code = code;
  g.version = (await store.rooms.readRoom(code)).version;
  store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(g), g.version, code);
  store.writes.length = 0;
  assert.equal((await store.rooms.readSeatView(code, auth[0])).nexusFremenBetrayal, null);
  assert.equal((await store.rooms.readSeatView(code, auth[2])).nexusFremenBetrayal?.mode, 'worm');
  const outcomes = await Promise.allSettled([
    store.restart().act(code, auth[2], g.version, play, clock),
    store.restart().act(code, auth[2], g.version, play, clock),
  ]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(result => result.status === 'rejected').length, 1);
  let saved = await store.restart().readRoom(code);
  assert.equal(saved.nexusFremenBetrayalHistory?.[0].mode, 'worm');
  assert.equal(nexusPlayer(saved, fremen).fremenNexusWormBlockedTurn, saved.turn);
  assert.equal(saved.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
  for (let i = 0; i < auth.length; i++) {
    if (!saved.ready.includes(auth[i].playerId)) {
      await store.restart().act(code, auth[i], saved.version, { type: 'ready' }, clock);
      saved = await store.restart().readRoom(code);
    }
  }
  for (let step = 0; saved.response && step < 8; step++) {
    const id = saved.players.find(player => !saved.response!.passed.includes(player.id))!.id;
    const index = auth.findIndex(seat => seat.playerId === id);
    await store.restart().act(code, auth[index], saved.version, { type: 'passResponse' }, clock);
    saved = await store.restart().readRoom(code);
  }
  assert.equal(saved.nexus, true);
  assert.deepEqual(saved.wormRides, []);
  assert.notEqual(saved.decision?.kind, 'wormRide');
  assert.equal(saved.nexusFremenCunningOffer ?? null, null);
  assert.equal(nexusPlayer(saved, fremen).forces['red_chasm:7'], 4);
  for (const token of tokens) {
    const seat = await store.restart().authenticate(code, token);
    const view = await store.restart().readSeatView(code, seat);
    assert.equal(view.players.find(player => player.id === fremen)!.fremenNexusWormBlocked, true);
    assert.equal(view.nexusFremenBetrayal, null);
  }
  const before = store.sqlite.prepare('SELECT state, version FROM rooms WHERE code = ?').get(code);
  await assert.rejects(store.restart().act(code, auth[2], saved.version, play, clock));
  assert.deepEqual(store.sqlite.prepare('SELECT state, version FROM rooms WHERE code = ?').get(code), before);
  assert.equal(saved.nexusCards!.cards!.hands[holder], null);
});
