import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  newPlayer,
  joinGame,
  applyAction,
  viewGame,
  normalizeAutomaticGame,
  prepareSpecialKaramaIntent,
  executeSpecialKaramaIntent,
  type Game,
} from '../game/engine';
import { baseDeck, leaders } from '../game/cards';
import { richeseCards } from '../game/richese-cards';

function fixture(emperor = true) {
  let g = createGame('RICHBUY2', newPlayer('r', 'Richese', 'guild'));
  joinGame(g, newPlayer('h', 'Harkonnen', 'harkonnen'));
  joinGame(g, newPlayer('e', 'Observer', emperor ? 'emperor' : 'atreides'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'r', { type: 'start' });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  g.players[0].faction = 'richese';
  g.players[0].leaders = leaders('richese');
  g.players.forEach((p) => {
    p.hand = [];
    p.spice = 10;
  });
  g.deck = baseDeck();
  g.discard = [];
  const k = g.deck.findIndex((c) => c.effect === 'karama');
  g.players[0].hand.push(...g.deck.splice(k, 1));
  g.richeseCache = richeseCards();
  g.richeseRemoved = [];
  g.advanced = true;
  g.phase = 2;
  g.turn = 2;
  g.phaseOpening = null;
  g.response = null;
  g.decision = null;
  g.ready = [];
  return g;
}
function purchase(g: Game, acquire = 'richese-ornithopter') {
  return applyAction(g, 'r', {
    type: 'card',
    mode: 'special',
    card: g.players[0].hand.find((c) => c.effect === 'karama')!.id,
    acquire,
  });
}
function cancelCard(g: Game, id = 'h') {
  const k = g.deck.findIndex((c) => c.effect === 'karama');
  g.players.find((p) => p.id === id)!.hand.push(...g.deck.splice(k, 1));
}
function physical(g: Game) {
  return [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...(g.richeseCache ?? []),
    ...(g.richeseRemoved ?? []),
  ]
    .map((c) => c.id)
    .sort();
}
void test('special Karama buys a privately selected cache card and auto-collects separate Emperor income once', () => {
  const before = fixture(),
    stock = physical(before),
    snapshot = JSON.stringify(before);
  const g = purchase(before);
  assert.equal(JSON.stringify(before), snapshot);
  assert.equal(g.players[0].spice, 7);
  assert.equal(g.players[2].spice, 13);
  assert.equal(g.players[0].specialKaramaUsed, true);
  assert.equal(g.players[0].hand[0].id, 'richese-ornithopter');
  assert.equal(g.richeseCache!.length, 9);
  assert.equal(g.response, null);
  assert.equal(g.pendingRichesePurchaseIncome, null);
  assert.deepEqual(physical(g), stock);
  assert.deepEqual(normalizeAutomaticGame(JSON.parse(JSON.stringify(g))), g);
  for (const observer of ['h', 'e']) {
    const view = viewGame(g, observer);
    assert.equal(view.richeseSpecialKarama, null);
    assert.equal(JSON.stringify(view).includes('richese-ornithopter'), false);
  }
});
void test('Emperor income can be canceled without reversing or revealing the uncancelable acquisition', () => {
  const before = fixture();
  cancelCard(before);
  let g = purchase(before);
  assert.equal(g.response?.kind, 'richesePurchaseIncome');
  assert.equal(g.players[2].spice, 10);
  const saved = JSON.parse(JSON.stringify(g)) as Game;
  g = applyAction(saved, 'h', {
    type: 'card',
    mode: 'cancel',
    card: saved.players[1].hand[0].id,
  });
  assert.equal(g.players[2].spice, 10);
  assert.equal(g.players[0].spice, 7);
  assert.equal(g.players[0].hand[0].id, 'richese-ornithopter');
  assert.equal(g.players[0].specialKaramaUsed, true);
  assert.equal(g.pendingRichesePurchaseIncome, null);
  assert.equal(g.response, null);
});
void test('purchase without Emperor pays bank and preserves enclosing decision', () => {
  const before = fixture(false);
  before.decision = { kind: 'wormPlacement', player: 'h' };
  const g = purchase(before);
  assert.deepEqual(g.decision, before.decision);
  assert.equal(g.players[2].spice, 10);
  assert.equal(g.players[0].spice, 7);
});
void test('income continuation restores exact enclosing response and decision after cancellation', () => {
  const before = fixture();
  cancelCard(before);
  // One additional canceller keeps the restored outer response open.
  cancelCard(before, 'e');
  before.response = {
    kind: 'voice',
    owner: 'r',
    passed: ['e'],
    intent: 'Outer response',
  };
  before.decision = { kind: 'wormPlacement', player: 'h' };
  let g = purchase(before);
  assert.equal(g.decision, null);
  assert.deepEqual(
    g.pendingRichesePurchaseIncome?.resume.response,
    before.response,
  );
  g = applyAction(g, 'h', { type: 'passResponse' });
  // Emperor owns the income and cannot cancel it; outer h retains Karama.
  assert.deepEqual(g.response, before.response);
  assert.deepEqual(g.decision, before.decision);
  assert.equal(g.players[2].spice, 13);
});
void test('private options validate exactly and do not mutate state or expose cache to opponents', () => {
  const g = fixture(),
    before = JSON.stringify(g);
  const own = viewGame(g, 'r').richeseSpecialKarama!;
  assert.equal(own.cards.length, 10);
  assert.equal(own.karamas.length, 1);
  assert.equal(own.blocked, null);
  assert.equal(own.payee, 'e');
  assert.equal(JSON.stringify(g), before);
  assert.equal(viewGame(g, 'h').richeseSpecialKarama, null);
  assert.throws(() => purchase(g, 'not-a-cache-card'), /verified card/);
  g.richeseCache![0].name = 'Forged face';
  assert.throws(() => purchase(g), /verified card/);
});
void test('full-hand and last-cache capacity edges remain explicit atomic implementation guards', () => {
  const g = fixture();
  g.players[0].hand.push(...g.deck.splice(0, 3));
  const before = JSON.stringify(g);
  assert.throws(() => purchase(g), /awaits a ruling/);
  assert.equal(JSON.stringify(g), before);
  assert.match(
    viewGame(g, 'r').richeseSpecialKarama!.blocked!,
    /awaits a ruling/,
  );
  g.players[0].hand.splice(1);
  g.richeseCache = g.richeseCache!.slice(0, 1);
  assert.throws(() => purchase(g), /empty-cache/);
});
void test('insufficient or pledged spice, Basic mode, used power and committed Karama are rejected atomically', () => {
  for (const configure of [
    (g: Game) => {
      g.players[0].spice = 2;
    },
    (g: Game) => {
      g.advanced = false;
    },
    (g: Game) => {
      g.players[0].specialKaramaUsed = true;
    },
    (g: Game) => {
      g.auction = {
        cards: [g.deck.pop()!],
        index: 0,
        bid: 8,
        bidder: 'r',
        active: 'h',
        passed: [],
        opener: 0,
      };
    },
  ]) {
    const g = fixture();
    configure(g);
    const before = JSON.stringify(g);
    assert.throws(() => purchase(g));
    assert.equal(JSON.stringify(g), before);
  }
});
void test('normalized private intent revalidates exact selected card and window before execution', () => {
  const g = fixture();
  const intent = prepareSpecialKaramaIntent(g, 'r', {
    type: 'card',
    mode: 'special',
    card: g.players[0].hand[0].id,
    acquire: 'richese-ornithopter',
  });
  const changed = structuredClone(g);
  changed.richeseCache!.shift();
  assert.throws(
    () => executeSpecialKaramaIntent(changed, intent),
    /verified card/,
  );
  const later = structuredClone(g);
  later.phase++;
  assert.throws(
    () => executeSpecialKaramaIntent(later, intent),
    /earlier turn or phase/,
  );
});
