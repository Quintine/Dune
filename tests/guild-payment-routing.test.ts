import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';

type Route = 'reserve' | 'cross' | 'return';
type Direction = 'guildShips' | 'guildFunds' | 'otherFunds';
function player(g: Game, id: string) {
  return g.players.find((p) => p.id === id)!;
}
function fixture(direction: Direction, route: Route, guildPresent = true) {
  let g = createGame('PAYROUTE', newPlayer('e', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  if (guildPresent) joinGame(g, newPlayer('g', 'Guild', 'guild'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'e', { type: 'start' });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  assert.equal(g.status, 'playing');
  g.phase = 5;
  g.turn = 2;
  g.storm = 18;
  g.order = g.players.map((p) => p.id);
  g.movementRemaining = [...g.order];
  g.deck = baseDeck();
  g.discard = [];
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.spice = 20;
    p.hand = [];
    p.traitors = [];
  }
  const shipper = direction === 'guildShips' ? 'g' : 'e';
  const donor =
    direction === 'guildFunds' ? 'g' : direction === 'guildShips' ? 'e' : 'a';
  player(g, shipper).ally = donor;
  player(g, donor).ally = shipper;
  g.active = shipper;
  if (route !== 'reserve') {
    player(g, shipper).forces = { 'arrakeen:10': 4 };
    player(g, shipper).reserves = 16;
  }
  g = applyAction(g, donor, { type: 'pledgeAid', amount: 4 });
  return { g, shipper, donor };
}
function holdKarama(g: Game, id: string) {
  const index = g.deck.findIndex((card) => card.effect === 'karama');
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  player(g, id).hand.push(card);
  return card;
}
function shipment(route: Route, allyPayment?: number): Action {
  return {
    type: route === 'reserve' ? 'ship' : 'guildShip',
    ...(route === 'reserve' ? {} : { from: 'arrakeen:10' }),
    territory: route === 'return' ? 'reserves' : 'carthag',
    sector: route === 'return' ? 0 : 11,
    amount: 4,
    ...(allyPayment === undefined ? {} : { allyPayment }),
  };
}
function assertArrival(g: Game, shipper: string, route: Route) {
  const p = player(g, shipper);
  assert.equal(p.shipped, true);
  assert.equal(p.moved, 0);
  assert.equal(p.forces['arrakeen:10'] ?? 0, 0);
  assert.equal(p.forces['carthag:11'] ?? 0, route === 'return' ? 0 : 4);
  assert.equal(p.reserves, route === 'return' ? 20 : 16);
}
function allowIncome(g: Game) {
  let next = g;
  for (let i = 0; next.response && i < 3; i++) {
    assert.equal(next.response.kind, 'guildIncome');
    const responder = next.players.find((p) => {
      const controls = viewGame(next, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length;
    });
    assert.ok(responder);
    next = applyAction(next, responder.id, { type: 'passResponse' });
  }
  assert.equal(next.response, null);
  return next;
}

for (const route of ['reserve', 'cross', 'return'] as const)
  void test(`non-Guild ally funding a Guild ${route} shipment credits only the contributor's share at zero, partial and full splits`, () => {
    for (const split of [0, 1, 2]) {
      const { g, shipper, donor } = fixture('guildShips', route);
      const before = structuredClone(g);
      const after = applyAction(g, shipper, shipment(route, split));
      // Cost two: Guild pays its own share to the bank; the non-Guild contribution goes to Guild.
      assert.equal(player(after, 'g').spice, 20 - (2 - split) + split);
      assert.equal(player(after, donor).spice, 16);
      assert.equal(after.aid[donor].amount, 4 - split);
      assert.equal(after.response, null);
      assertArrival(after, shipper, route);
      assert.deepEqual(g, before);
    }
  });

for (const route of ['reserve', 'cross'] as const)
  void test(`Guild-funded allied ${route} shipment sends Guild's contribution to the bank and only the shipper's payment to Guild`, () => {
    for (const split of [0, 1, 2]) {
      const { g, shipper, donor } = fixture('guildFunds', route);
      const after = applyAction(g, shipper, shipment(route, split));
      assert.equal(player(after, shipper).spice, 20 - (2 - split));
      assert.equal(player(after, 'g').spice, 16 + (2 - split));
      assert.equal(after.aid[donor].amount, 4 - split);
      assert.equal(after.response, null);
      assertArrival(after, shipper, route);
    }
  });

void test('a third-party Guild receives both non-Guild payment shares, while its absence sends both shares to the bank', () => {
  for (const guildPresent of [true, false])
    for (const split of [0, 2, 4]) {
      const { g, shipper, donor } = fixture(
        'otherFunds',
        'reserve',
        guildPresent,
      );
      const after = applyAction(g, shipper, shipment('reserve', split));
      assert.equal(player(after, shipper).spice, 20 - (4 - split));
      assert.equal(player(after, donor).spice, 16);
      assert.equal(after.aid[donor].amount, 4 - split);
      if (guildPresent) assert.equal(player(after, 'g').spice, 24);
      assert.equal(after.response, null);
      assertArrival(after, shipper, 'reserve');
    }
});

void test('default contribution uses the pre-income budget, and malformed explicit splits cannot spend or create spice', () => {
  for (const route of ['reserve', 'cross', 'return'] as const) {
    const { g, shipper, donor } = fixture('guildShips', route);
    player(g, shipper).spice = 0;
    const after = applyAction(g, shipper, shipment(route));
    assert.equal(player(after, 'g').spice, 2);
    assert.equal(after.aid[donor].amount, 2);
    assertArrival(after, shipper, route);
    for (const split of [-1, 1, 3, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const before = structuredClone(g);
      assert.throws(() => applyAction(g, shipper, shipment(route, split)));
      assert.deepEqual(g, before);
    }
  }
});

void test('Guild income from either contributor direction can be allowed or canceled without refunding or replaying the shipment', () => {
  for (const direction of ['guildShips', 'guildFunds'] as const)
    for (const route of (direction === 'guildShips'
      ? ['reserve', 'cross', 'return']
      : ['reserve', 'cross']) as Route[])
      for (const cancel of [false, true]) {
        const { g, shipper, donor } = fixture(direction, route);
        const card = holdKarama(g, 'a');
        const beforeGuild = player(g, 'g').spice;
        const pending = applyAction(g, shipper, shipment(route, 1));
        assert.equal(pending.response?.kind, 'guildIncome');
        assert.equal(pending.response?.owner, 'g');
        assert.equal(pending.response?.amount, 1);
        const paidGuild = beforeGuild - (shipper === 'g' ? 1 : 0);
        assert.equal(player(pending, 'g').spice, paidGuild);
        assert.equal(pending.aid[donor].amount, 3);
        assertArrival(pending, shipper, route);
        const restored = JSON.parse(JSON.stringify(pending)) as Game;
        const done = cancel
          ? applyAction(restored, 'a', {
              type: 'card',
              mode: 'cancel',
              card: card.id,
            })
          : allowIncome(restored);
        assert.equal(player(done, 'g').spice, paidGuild + (cancel ? 0 : 1));
        assert.equal(done.aid[donor].amount, 3);
        assertArrival(done, shipper, route);
        assert.equal(done.response, null);
        assert.equal(
          done.discard.filter((c) => c.id === card.id).length,
          cancel ? 1 : 0,
        );
        const beforeRetry = structuredClone(done);
        assert.throws(() => applyAction(done, shipper, shipment(route, 1)));
        assert.deepEqual(done, beforeRetry);
      }
});

void test('an independently purchased Karama shipment rate sends every contributor share to the bank', () => {
  for (const direction of ['guildShips', 'guildFunds', 'otherFunds'] as const)
    for (const route of (direction === 'guildShips'
      ? ['reserve', 'cross', 'return']
      : direction === 'guildFunds'
        ? ['reserve', 'cross']
        : ['reserve']) as Route[])
      for (const split of [0, 1, 2]) {
        const { g: initial, shipper, donor } = fixture(direction, route);
        let g = initial;
        const owner = direction === 'otherFunds' ? 'g' : 'a';
        const rate = holdKarama(g, owner);
        g = applyAction(g, owner, {
          type: 'card',
          mode: 'shipment',
          target: shipper,
          card: rate.id,
        });
        assert.equal(g.karamaShipping?.player, shipper);
        const beforeGuild = player(g, 'g').spice;
        const after = applyAction(g, shipper, shipment(route, split));
        assert.equal(
          player(after, shipper).spice,
          player(g, shipper).spice - (2 - split),
        );
        assert.equal(
          player(after, 'g').spice,
          beforeGuild - (shipper === 'g' ? 2 - split : 0),
        );
        assert.equal(after.aid[donor].amount, 4 - split);
        assert.equal(after.response, null);
        assert.equal(after.karamaShipping, null);
        assert.equal(after.discard.filter((c) => c.id === rate.id).length, 1);
        assertArrival(after, shipper, route);
      }
});
