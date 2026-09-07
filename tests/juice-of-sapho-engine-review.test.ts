import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';

const card = 'richese-juice-of-sapho';
function fixture() {
  const g = createGame(
    'SAPHOREVIEW',
    newPlayer('r', 'Richese', 'richese'),
    false,
    ['choam'],
  );
  g.players.push(
    newPlayer('a', 'Atreides', 'atreides'),
    newPlayer('e', 'Emperor', 'emperor'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'a',
    order: ['a', 'r', 'e'],
    movementRemaining: ['a', 'r', 'e'],
    deck: baseDeck(),
    richeseCache: richeseCards(),
  });
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.spice = 20;
  }
  const index = g.richeseCache!.findIndex((c) => c.id === card);
  g.players[0].hand.push(g.richeseCache!.splice(index, 1)[0]);
  return g;
}
function hold(g: Game, owner: string, effect: string) {
  const index = g.deck.findIndex((c) => c.effect === effect);
  assert.ok(index >= 0, effect);
  const c = g.deck.splice(index, 1)[0];
  g.players.find((p) => p.id === owner)!.hand.push(c);
  return c.id;
}
function play(g: Game): Action {
  return {
    type: 'card',
    card,
    mode: 'last',
    scope: 'movement',
    event: `movement:${g.turn}`,
  };
}
function blocked(g: Game) {
  assert.deepEqual(viewGame(g, 'r').saphoOptions, []);
  const before = JSON.stringify(g);
  assert.throws(() => applyAction(g, 'r', play(g)));
  assert.equal(JSON.stringify(g), before);
}

void test('an actual reserved Richese gift suppresses Sapho and cannot discard its pending physical card', () => {
  let g = fixture();
  g.players[0].ally = 'a';
  g.players[1].ally = 'r';
  hold(g, 'e', 'karama');
  g = applyAction(g, 'r', { type: 'richeseGift', card });
  assert.equal(g.response?.kind, 'richeseGift');
  assert.equal(g.pendingRicheseGift!.intent.cardId, card);
  blocked(g);
  g = applyAction(JSON.parse(JSON.stringify(g)), 'e', { type: 'passResponse' });
  assert.equal(g.pendingRicheseGift, null);
  assert.ok(g.players[1].hand.some((c) => c.id === card));
  assert.equal(
    g.discard.some((c) => c.id === card),
    false,
  );
  assert.deepEqual(viewGame(g, 'r').saphoOptions, []);
});

void test('actual Truthtrance priority and answer overlays block Sapho without altering future movement opportunity', () => {
  let g = fixture();
  const truth = hold(g, 'e', 'truthtrance');
  g = applyAction(g, 'e', { type: 'card', card: truth });
  blocked(g);
  while (g.truthtrance?.stage === 'priority') {
    const actor = g.players.find(
      (p) => !g.truthtrance!.passed.includes(p.id),
    )!.id;
    g = applyAction(g, actor, { type: 'truthPass' });
  }
  blocked(g);
  g = applyAction(g, 'e', {
    type: 'truthAsk',
    question: {
      kind: 'fact',
      target: 'r',
      fact: { kind: 'spice', compare: 'gte', value: 0 },
    },
  });
  blocked(g);
  g = applyAction(g, 'r', { type: 'truthAnswer', answer: 'yes' });
  assert.ok(viewGame(g, 'r').saphoOptions.some((o) => o.mode === 'last'));
  g = applyAction(g, 'r', play(g));
  assert.deepEqual(g.movementRemaining, ['a', 'e', 'r']);
});

void test('a real Karama response to shipment retains the suspended declaration when Sapho is rejected', () => {
  let g = fixture();
  g.advanced = true;
  g.players[2].faction = 'guild';
  hold(g, 'e', 'karama');
  g = applyAction(g, 'a', {
    type: 'ship',
    territory: 'polar_sink',
    sector: 0,
    amount: 1,
  });
  assert.ok(g.decision || g.response || g.pendingShipment);
  blocked(g);
});

void test('unsupported scopes and malformed requests are rejected atomically despite a valid physical holder', () => {
  const g = fixture();
  for (const extra of [
    { scope: 'normalAuction' },
    { scope: 'silent' },
    { scope: 'battle' },
    { mode: 'aggressor' },
    { mode: 'next' },
    { event: 'movement:1' },
    { event: undefined },
    { scope: undefined },
    { mode: undefined },
  ]) {
    const before = JSON.stringify(g);
    assert.throws(() => applyAction(g, 'r', { ...play(g), ...extra }));
    assert.equal(JSON.stringify(g), before);
  }
});
