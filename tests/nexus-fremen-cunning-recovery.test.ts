import assert from 'node:assert/strict';
import test from 'node:test';
import { type Action, type Game, viewGame } from '../game/engine';
import { presenceAt } from '../game/force-presence';
import type { RoomsClock } from '../db/rooms';
import { nexusInventory, nexusReady, nexusTurnTwo, orderNexusSpice } from './fixture-nexus-cards';
import { unitStore } from './fixture-nexus-room-store';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

async function fixture() {
  const store = unitStore();
  const made = await store.rooms.createRoom('Fremen Cunning SQL', 'fremen', true, []);
  const code = made.view.code;
  const tokens = [made.token];
  for (const faction of ['atreides', 'harkonnen'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  const ids = auths.map(auth => auth.playerId) as [string, string, string];
  let g = nexusTurnTwo({ seatIds: ids, advanced: true });
  const cards = g.nexusCards!.cards!;
  const index = cards.deck.indexOf('fremen');
  assert.ok(index >= 0);
  cards.hands[ids[0]] = cards.deck.splice(index, 1)[0];
  const sector = g.storm === 14 ? 15 : 14;
  g.players[0].reserves--;
  g.players[0].forces[`wind_pass:${sector}`] = 1;
  orderNexusSpice(g, ['worm', 'land']);
  const empty = g.spiceDeck.find(card => 'territory' in card &&
    g.players.every(player => presenceAt(player, card.territory) === 0));
  assert.ok(empty && 'territory' in empty);
  g.spiceDeck.splice(g.spiceDeck.indexOf(empty), 1);
  if (!('territory' in g.spiceDeck[1])) {
    const nextLand = g.spiceDeck.findIndex((card, i) => i > 1 && 'territory' in card);
    assert.ok(nextLand > 1);
    g.spiceDeck.splice(1, 0, g.spiceDeck.splice(nextLand, 1)[0]);
  }
  g.spiceDiscard[0].push(empty);
  const karama = g.deck.findIndex(card => card.effect === 'karama');
  assert.ok(karama >= 0);
  g.players[1].hand.push(g.deck.splice(karama, 1)[0]);
  g = nexusReady(g);
  assert.equal(g.decision?.kind, 'nexusFremenCunningOffer');
  assert.ok('territory' in g.spiceDeck[0], 'The original worm must draw a land card next.');
  g.code = code;
  g.version = (await store.rooms.readRoom(code)).version;
  store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(g), g.version, code);
  store.writes.length = 0;
  async function act(seat: number, action: Action) {
    const current = await store.restart().readRoom(code);
    await store.restart().act(code, auths[seat], current.version, action, clock);
    return store.restart().readRoom(code);
  }
  async function assertPrivateSeats(state: Game) {
    for (const [i, token] of tokens.entries()) {
      const rooms = store.restart();
      const auth = await rooms.authenticate(code, token);
      const view = await rooms.readSeatView(code, auth);
      assert.deepEqual(view, viewGame(state, ids[i]));
      if (i !== 0) assert.equal(view.nexusCards?.card, null);
      for (const rival of view.players.filter(player => player.id !== auth.playerId)) {
        assert.equal(rival.hand, undefined);
        assert.equal(rival.traitors, undefined);
      }
    }
  }
  async function settleResponseAndReachRide() {
    for (let i = 0; i < 20; i++) {
      const current = await store.restart().readRoom(code);
      if (current.decision?.kind === 'nexusFremenCunningRide') return current;
      if (current.response) {
        const seat = ids.indexOf(current.players.find(player =>
          !current.response!.passed.includes(player.id))!.id);
        await act(seat, { type: 'passResponse' });
      } else {
        assert.equal(current.decision, null);
        const seat = ids.indexOf(current.players.find(player =>
          !current.ready.includes(player.id))!.id);
        await act(seat, { type: 'ready' });
      }
    }
    assert.fail('The saved accepted offer never reached its remote ride');
  }
  return { ...store, code, tokens, auths, ids, initial: g, sector, empty,
    act, assertPrivateSeats, settleResponseAndReachRide };
}

void test('SQLite races one accepted Fremen offer, restores private Karama response and later rides exactly one force', async () => {
  const f = await fixture();
  try {
    const event = f.initial.nexusFremenCunningOffer!.occurrence.event;
    const originalReserves = f.initial.players[0].reserves;
    const polarBefore = f.initial.players[0].forces['polar_sink:0'] ?? 0;
    await f.assertPrivateSeats(f.initial);
    assert.equal((await f.restart().readSeatView(f.code, f.auths[0])).nexusCards?.card, 'fremen');
    let arrivals = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
    let results: PromiseSettledResult<unknown>[];
    try {
      results = await Promise.allSettled([0, 1].map(() =>
        f.restart().act(f.code, f.auths[0], f.initial.version,
          { type: 'decision', event, accept: true }, clock)));
    } finally { delete f.hooks.beforeWrite; }
    assert.equal(arrivals, 2);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.deepEqual(f.writes.map(write => write.changes).sort((a, b) => a - b), [0, 1]);
    let g = await f.restart().readRoom(f.code);
    assert.equal(g.version, f.initial.version + 1);
    assert.equal(g.response?.kind, 'nexusFremenCunning');
    assert.equal(g.nexusFremenCunningRides?.length, 1);
    assert.equal(g.nexusCards!.cards!.hands[f.ids[0]], null);
    assert.equal(g.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
    assert.equal(g.players[0].forces[`wind_pass:${f.sector}`], 1);
    nexusInventory(g);
    await f.assertPrivateSeats(g);
    await assert.rejects(f.restart().act(f.code, f.auths[0], f.initial.version,
      { type: 'decision', event, accept: true }, clock), /table changed/i);
    g = await f.settleResponseAndReachRide();
    assert.equal(g.nexusFremenCunningRides?.[0].stage, 'select');
    assert.ok(g.spiceDiscard[0].length > f.initial.spiceDiscard[0].length);
    await f.assertPrivateSeats(g);
    g = await f.act(0, {
      type: 'decision', event, accept: true, source: 'wind_pass',
      forces: { [`wind_pass:${f.sector}`]: { normal: 1, elite: 0 } },
      territory: 'polar_sink', sector: 0,
    });
    assert.equal(g.nexusFremenCunningRides?.[0].stage, 'complete');
    assert.equal(g.players[0].forces[`wind_pass:${f.sector}`] ?? 0, 0);
    assert.equal(g.players[0].forces['polar_sink:0'], polarBefore + 1);
    assert.equal(g.players[0].reserves, originalReserves);
    assert.equal(g.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
    nexusInventory(g);
    await f.assertPrivateSeats(g);
    const saved = JSON.stringify(g);
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(JSON.stringify(await f.restart().readRoom(f.code)), saved);
  } finally { f.sqlite.close(); }
});

void test('SQLite Karama cancellation of a spent remote ride preserves original worm and never moves the source', async () => {
  const f = await fixture();
  try {
    const event = f.initial.nexusFremenCunningOffer!.occurrence.event;
    await f.act(0, { type: 'decision', event, accept: true });
    const response = await f.restart().readRoom(f.code);
    assert.equal(response.response?.kind, 'nexusFremenCunning');
    const card = response.players[1].hand.find(item => item.effect === 'karama');
    assert.ok(card);
    const g = await f.act(1, { type: 'card', card: card.id, mode: 'cancel' });
    assert.equal(g.nexusFremenCunningRides?.[0].stage, 'complete');
    assert.equal(g.players[0].forces[`wind_pass:${f.sector}`], 1);
    assert.equal(g.players[0].forces[`${f.empty.territory}:${f.empty.sector}`] ?? 0, 0);
    assert.equal(g.players[0].forces['polar_sink:0'] ?? 0,
      f.initial.players[0].forces['polar_sink:0'] ?? 0);
    assert.equal(g.nexusFremenCunningOffer, null);
    assert.equal(g.spiceDiscard[0].length, f.initial.spiceDiscard[0].length + 1);
    const nextSpice = f.initial.spiceDeck[0];
    assert.ok('territory' in nextSpice);
    assert.equal(g.spiceWindow?.territory, nextSpice.territory);
    assert.equal(g.nexusCards!.cards!.discard.filter(item => item === 'fremen').length, 1);
    nexusInventory(g);
    await f.assertPrivateSeats(g);
    const saved = JSON.stringify(g);
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(JSON.stringify(await f.restart().readRoom(f.code)), saved);
  } finally { f.sqlite.close(); }
});
