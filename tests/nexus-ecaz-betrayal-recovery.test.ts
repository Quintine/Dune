import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import type * as Rooms from '../db/rooms';
import type { RoomsClock, SeatAuth } from '../db/rooms';
import {
  finishNexusSpice, nexusAllow, nexusInventory, nexusPlayer, nexusReady,
  nexusTurnTwo, orderNexusSpice,
} from './fixture-nexus-cards';
import { unitStore } from './fixture-nexus-room-store';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

async function fixture(t: test.TestContext): Promise<Fixture> {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom('Ecaz Betrayal SQL', 'ecaz', true, ['ecaz']);
  const code = made.view.code;
  const tokens = [made.token];
  for (const faction of ['emperor', 'harkonnen'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  const ids = auths.map(auth => auth.playerId) as [string, string, string];
  const [ecaz, ally, owner] = ids;

  let g = nexusTurnTwo({ seatIds: ids, hostFaction: 'ecaz', secondFaction: 'emperor', advanced: true });
  orderNexusSpice(g, ['worm', 'land', 'land']);
  g = nexusReady(nexusReady(g));
  g = applyAction(g, ecaz, { type: 'alliance', target: ally });
  g = applyAction(g, ally, { type: 'alliance', target: ecaz });
  assert.equal(nexusPlayer(g, ecaz).ally, ally);
  assert.equal(nexusPlayer(g, ally).ally, ecaz);
  g = finishNexusSpice(g);
  assert.equal(g.nexusCards!.phase!.stage, 'drawing');
  const cards = g.nexusCards!.cards!;
  const index = cards.deck.indexOf('ecaz');
  assert.ok(index >= 0);
  cards.deck.splice(index, 1);
  cards.deck.unshift('ecaz');
  g = applyAction(g, owner, {
    type: 'nexusCardChoice', turn: g.turn, card: null, choice: 'draw', ownRedraws: 0,
  });
  assert.equal(g.nexusCards!.cards!.hands[owner], 'ecaz');
  g = nexusReady(g);
  for (let step = 0; g.phase === 3 && step < 30; step++) {
    if (g.phaseOpening) {
      const id = g.players.find(p => !g.phaseOpening!.passed.includes(p.id))!.id;
      g = applyAction(g, id, { type: 'ready' });
    } else if (g.auction) {
      g = applyAction(g, g.auction.active, { type: 'passBid' });
    } else g = nexusReady(g);
  }
  assert.equal(g.phase, 4);
  for (let step = 0; g.phase === 4 && step < 10; step++) {
    if (g.decision?.kind === 'ecazPlacement')
      g = applyAction(g, g.decision.player, { type: 'decision', decline: true });
    else if (g.response) g = nexusAllow(g);
    else g = nexusReady(g);
  }
  assert.equal(g.phase, 5);
  assert.equal(g.active, g.order[0]);
  assert.deepEqual(g.movementRemaining, g.order);

  // Move existing physical Emperor counters, including Sardaukar, not minted ones.
  const target = nexusPlayer(g, ally);
  target.reserves += Object.values(target.forces).reduce((sum, n) => sum + n, 0);
  target.elites!.reserves += Object.values(target.elites!.forces).reduce((sum, n) => sum + n, 0);
  target.forces = { 'wind_pass:14': 3, 'wind_pass:15': 2, 'carthag:11': 1 };
  target.elites!.forces = { 'wind_pass:14': 1, 'wind_pass:15': 1 };
  target.reserves -= 6;
  target.elites!.reserves -= 2;
  const native = nexusPlayer(g, ecaz);
  native.reserves -= 2;
  native.forces['wind_pass:14'] = (native.forces['wind_pass:14'] ?? 0) + 2;
  const karamaIndex = g.deck.findIndex(card => card.effect === 'karama');
  assert.ok(karamaIndex >= 0);
  const karama = g.deck.splice(karamaIndex, 1)[0];
  native.hand.push(karama);
  nexusInventory(g);
  const offer = viewGame(g, owner).nexusEcazBetrayal!;
  assert.equal(offer.blocked, null);
  assert.equal(offer.ally, ally);
  assert.deepEqual(offer.territories.find(row => row.territory === 'wind_pass'), {
    territory: 'wind_pass',
    sectors: {
      'wind_pass:14': { normal: 2, elite: 1 },
      'wind_pass:15': { normal: 1, elite: 1 },
    },
    total: { normal: 3, elite: 2 },
  });
  const action: Action = { type: 'nexusEcazBetrayal', event: offer.event, territory: 'wind_pass' };
  g.code = code;
  g.version = (await store.rooms.readRoom(code)).version;
  store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(g), g.version, code);
  store.writes.length = 0;
  return { ...store, code, tokens, auths, ids, ecaz, ally, owner, karama: karama.id,
    action, initial: g };
}
interface Fixture {
  code: string;
  tokens: string[];
  auths: SeatAuth[];
  ids: [string, string, string];
  ecaz: string;
  ally: string;
  owner: string;
  karama: string;
  action: Action;
  initial: Game;
  sqlite: DatabaseSync;
  restart(): typeof Rooms;
  hooks: { beforeWrite?: () => Promise<void> };
  writes: { expected: number; changes: number }[];
}

const row = (f: Fixture) => f.sqlite.prepare('SELECT state, version FROM rooms WHERE code = ?')
  .get(f.code);

async function restored(f: Fixture, g: Game) {
  const saved = row(f);
  for (const [i, token] of f.tokens.entries()) {
    const rooms = f.restart();
    const auth = await rooms.authenticate(f.code, token);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, viewGame(g, f.ids[i]));
    if (i === 2 && g.nexusCards!.cards!.hands[f.owner] === 'ecaz') {
      assert.equal(view.nexusEcazBetrayal?.blocked, null);
      assert.equal(view.nexusEcazBetrayal?.ally, f.ally);
    } else assert.equal(view.nexusEcazBetrayal, null);
    assert.equal(view.nexusCards?.card, i === 2 ? g.nexusCards!.cards!.hands[f.owner] : null);
    assert.equal(Object.hasOwn(view, 'nexusEcazBetrayalHistory'), false);
    for (const rival of view.players.filter(player => player.id !== auth.playerId)) {
      assert.equal('hand' in rival, false);
      assert.equal('traitors' in rival, false);
    }
  }
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(row(f), saved);
  nexusInventory(g);
  for (const p of g.players)
    if (p.elites) {
      const initial = nexusPlayer(f.initial, p.id).elites!;
      assert.equal(
        p.elites.reserves + p.elites.tanks +
          Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0),
        initial.reserves + initial.tanks +
          Object.values(initial.forces).reduce((sum, n) => sum + n, 0),
      );
    }
}

async function act(f: Fixture, index: number, action: Action) {
  const current = await f.restart().readRoom(f.code);
  await f.restart().act(f.code, f.auths[index], current.version, action, clock);
  return f.restart().readRoom(f.code);
}

async function passKaramaHolder(f: Fixture) {
  const current = await f.restart().readRoom(f.code);
  assert.equal(current.response?.kind, 'nexusEcazBetrayal');
  assert.ok(viewGame(current, f.ecaz).responseControls?.cancelCards.length);
  const done = await act(f, 0, { type: 'passResponse' });
  assert.equal(done.response, null);
  return { done, count: 1 };
}

void test('SQLite concurrent Ecaz proposals spend one card; restart and allowance return both typed sectors once', async t => {
  const f = await fixture(t);
  await restored(f, f.initial);
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  f.hooks.beforeWrite = async () => {
    if (++arrivals === 2) release();
    await gate;
  };
  // Both independent room-module instances yield on the actual SQL write hook.
  let results: PromiseSettledResult<unknown>[];
  try {
    results = await Promise.allSettled([0, 1].map(() =>
      f.restart().act(f.code, f.auths[2], f.initial.version, f.action, clock)));
  } finally {
    delete f.hooks.beforeWrite;
  }
  assert.equal(arrivals, 2);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.deepEqual(f.writes.map(write => write.changes).sort((a, b) => a - b), [0, 1]);
  const pending = await f.restart().readRoom(f.code);
  assert.equal(pending.version, f.initial.version + 1);
  assert.equal(pending.response?.kind, 'nexusEcazBetrayal');
  assert.equal(pending.nexusEcazBetrayalHistory?.length, 1);
  assert.equal(pending.nexusEcazBetrayalHistory?.[0].stage, 'pending');
  assert.equal(pending.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(pending.nexusCards!.cards!.discard.filter(card => card === 'ecaz').length, 1);
  assert.deepEqual(nexusPlayer(pending, f.ally).forces, nexusPlayer(f.initial, f.ally).forces);
  assert.deepEqual(nexusPlayer(pending, f.ally).elites, nexusPlayer(f.initial, f.ally).elites);
  await restored(f, pending);
  const saved = row(f);
  await assert.rejects(f.restart().act(f.code, f.auths[2], f.initial.version,
    f.action, clock), /table changed/i);
  await assert.rejects(f.restart().act(f.code, f.auths[2], pending.version,
    f.action, clock), /Ecaz|Nexus/);
  assert.deepEqual(row(f), saved);

  const { done, count } = await passKaramaHolder(f);
  assert.equal(done.version, pending.version + count);
  const initialAlly = nexusPlayer(f.initial, f.ally);
  const returned = nexusPlayer(done, f.ally);
  for (const key of ['wind_pass:14', 'wind_pass:15']) {
    assert.equal(returned.forces[key], undefined);
    assert.equal(returned.elites!.forces[key], undefined);
  }
  assert.equal(returned.forces['carthag:11'], 1);
  assert.equal(returned.reserves, initialAlly.reserves + 5);
  assert.equal(returned.elites!.reserves, initialAlly.elites!.reserves + 2);
  assert.deepEqual(nexusPlayer(done, f.ecaz).forces, nexusPlayer(f.initial, f.ecaz).forces);
  assert.equal(done.nexusEcazBetrayalHistory?.[0].stage, 'complete');
  assert.equal(done.nexusEcazBetrayalHistory?.length, 1);
  assert.equal(done.nexusCards!.cards!.discard.filter(card => card === 'ecaz').length, 1);
  assert.equal(done.phase, 5);
  assert.equal(done.active, f.initial.active);
  assert.deepEqual(done.movementRemaining, f.initial.movementRemaining);
  assert.ok(done.players.every(player => !player.shipped && player.moved === 0));
  await restored(f, done);
  const settled = row(f);
  await assert.rejects(f.restart().act(f.code, f.auths[2], done.version,
    f.action, clock), /Ecaz|Nexus/);
  assert.deepEqual(row(f), settled);
});

void test('SQLite Karama response after restart spends both physical cards but leaves allied forces in place', async t => {
  const f = await fixture(t);
  await f.restart().act(f.code, f.auths[2], f.initial.version, f.action, clock);
  const pending = await f.restart().readRoom(f.code);
  assert.equal(pending.version, f.initial.version + 1);
  assert.equal(pending.response?.kind, 'nexusEcazBetrayal');
  await restored(f, pending);
  let canceled = await act(f, 0, { type: 'card', card: f.karama, mode: 'cancel' });
  assert.equal(canceled.version, pending.version + 1);
  const afterCard = canceled.version;
  assert.equal(canceled.nexusCards!.cards!.discard.filter(card => card === 'ecaz').length, 1);
  assert.equal(canceled.discard.filter(card => card.id === f.karama).length, 1);
  await restored(f, canceled);
  let passes = 0;
  while (canceled.response) {
    assert.ok(passes++ < f.ids.length);
    const index = f.ids.indexOf(canceled.players.find(p =>
      !canceled.response!.passed.includes(p.id))!.id);
    canceled = await act(f, index, { type: 'passResponse' });
  }
  assert.equal(canceled.version, afterCard + passes);
  assert.equal(canceled.response, null);
  assert.equal(canceled.nexusEcazBetrayalHistory?.length, 1);
  assert.equal(canceled.nexusEcazBetrayalHistory?.[0].stage, 'complete');
  for (const id of [f.ally, f.ecaz]) {
    const source = nexusPlayer(f.initial, id);
    const actual = nexusPlayer(canceled, id);
    assert.deepEqual(actual.forces, source.forces);
    assert.deepEqual(actual.elites, source.elites);
    assert.equal(actual.reserves, source.reserves);
  }
  assert.equal(canceled.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(canceled.nexusCards!.cards!.discard.filter(card => card === 'ecaz').length, 1);
  assert.equal(canceled.discard.filter(card => card.id === f.karama).length, 1);
  assert.equal(canceled.phase, 5);
  assert.equal(canceled.active, f.initial.active);
  assert.deepEqual(canceled.movementRemaining, f.initial.movementRemaining);
  await restored(f, canceled);
  const saved = row(f);
  await assert.rejects(f.restart().act(f.code, f.auths[2], canceled.version,
    f.action, clock), /Ecaz|Nexus/);
  assert.deepEqual(row(f), saved);
});
