import test from 'node:test';
import assert from 'node:assert/strict';
import type { RoomsClock } from '../db/rooms';
import { viewGame, type Action } from '../game/engine';
import { atomicsFixtureGame } from './fixture-moritani-atomics';
import { unitStore } from './fixture-nexus-room-store';

const clock: RoomsClock = { now: () => 45000, sleep: async () => {} };
const shipment: Action = { type: 'ship', territory: 'arrakeen', sector: 10, amount: 2 };

void test('Atomics persists one reveal, random overflow, custody and public Aftermath across concurrent SQL workers', async t => {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom('Atomics SQL', 'moritani', false, []);
  const code = made.view.code;
  const entrant = await store.rooms.joinRoom(code, 'Emperor', 'emperor');
  const ally = await store.rooms.joinRoom(code, 'Atreides', 'atreides');
  const tokens = [made.token, entrant.token!, ally.token!];
  const auth = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  const [m, e, a] = auth.map(seat => seat.playerId);
  const g = await store.rooms.readRoom(code);
  const { token } = atomicsFixtureGame(g, { moritani: m, entrant: e, ally: a });
  const originalM = g.players.find(p => p.id === m)!.hand.map(card => card.id);
  const originalA = g.players.find(p => p.id === a)!.hand.map(card => card.id);
  g.code = code;
  g.version = (await store.rooms.readRoom(code)).version;
  store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(g), g.version, code);
  store.writes.length = 0;
  const rooms = store.restart();
  const initialM = await rooms.readSeatView(code, auth[0]);
  const initialE = await rooms.readSeatView(code, auth[1]);
  assert.equal(initialM.moritaniAtomics, null);
  assert.equal(initialE.moritaniAtomics, null);
  assert.equal('kind' in initialE.moritaniTerror!.tokens.find(row => row.id === token)!, false);

  await store.restart().act(code, auth[1], g.version, shipment, clock);
  const offered = await store.restart().readRoom(code);
  assert.equal(offered.pendingTerrorEntry?.stage, 'offer');
  assert.equal(viewGame(offered, m).terrorEntry?.kind, 'atomics');
  assert.equal('kind' in (viewGame(offered, e).terrorEntry ?? {}), false);
  const reveal: Action = { type: 'decision', reveal: true };
  const outcomes = await Promise.allSettled([
    store.restart().act(code, auth[0], offered.version, reveal, clock),
    store.restart().act(code, auth[0], offered.version, reveal, clock),
  ]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(result => result.status === 'rejected').length, 1);
  const saved = await store.restart().readRoom(code);
  assert.equal(saved.moritaniAtomics?.territory, 'arrakeen');
  assert.equal(saved.moritaniAtomics?.allyAtActivation, a);
  assert.equal(saved.moritaniTerror!.tokens.find(row => row.id === token)!.status, 'removed');
  assert.equal(saved.pendingTerrorEntry, null);
  assert.equal(saved.pendingTreacheryDiscard ?? null, null);
  assert.equal(saved.players.find(p => p.id === e)!.tanks, 2);
  assert.equal(saved.players.find(p => p.id === a)!.tanks, 2);
  assert.equal(saved.players.find(p => p.id === m)!.hand.length, 3);
  assert.equal(saved.players.find(p => p.id === a)!.hand.length, 3);
  assert.equal(saved.discard.filter(card => originalM.includes(card.id)).length, 1);
  assert.equal(saved.discard.filter(card => originalA.includes(card.id)).length, 1);
  for (let i = 0; i < tokens.length; i++) {
    const authFresh = await store.restart().authenticate(code, tokens[i]);
    const view = await store.restart().readSeatView(code, authFresh);
    assert.deepEqual(view, viewGame(saved, authFresh.playerId));
    assert.equal(view.moritaniAtomics?.territory, 'arrakeen');
    assert.equal(view.players.find(p => p.id === m)!.handLimit, 3);
    assert.equal(view.players.find(p => p.id === a)!.handLimit, 3);
  }
  const beforeReplay = store.sqlite.prepare('SELECT state, version FROM rooms WHERE code = ?').get(code);
  await assert.rejects(store.restart().act(code, auth[0], saved.version, reveal, clock));
  assert.deepEqual(store.sqlite.prepare('SELECT state, version FROM rooms WHERE code = ?').get(code), beforeReplay);
  let later = saved;
  for (const index of [1, 0]) {
    await store.restart().act(code, auth[index], later.version, { type: 'endMovement' }, clock);
    later = await store.restart().readRoom(code);
  }
  assert.equal(later.active, a);
  const row = store.sqlite.prepare('SELECT state, version FROM rooms WHERE code = ?').get(code);
  await assert.rejects(store.restart().act(code, auth[2], later.version, shipment, clock), /Atomics Aftermath/);
  await store.restart().continueRoomAutomatic(code, clock);
  assert.deepEqual(store.sqlite.prepare('SELECT state, version FROM rooms WHERE code = ?').get(code), row);
});
