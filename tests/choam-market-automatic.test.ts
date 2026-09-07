import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

function fixture(advanced = false) {
  const g = createGame(
    'MARKETAUTO',
    newPlayer('c', 'CHOAM', 'choam'),
    advanced,
    ['choam'],
  );
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'Bene Gesserit', 'beneGesserit'),
  );
  g.status = 'playing';
  g.phase = 3;
  g.turn = 2;
  g.order = ['c', 'e', 'b'];
  g.choamCharity = { turn: 2, canceled: false };
  g.deck = baseDeck();
  for (const p of g.players) {
    p.hand = [];
    p.spice = 20;
    p.forces = {};
    p.traitorChoices = [];
  }
  return g;
}
function hold(g: Game, id: string, name: string) {
  const index = g.deck.findIndex((c) => c.name === name);
  assert.ok(index >= 0, name);
  const card = g.deck.splice(index, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(card);
  return card;
}
function cacheCard(g: Game, id: string, effect: string) {
  g.richeseCache ??= richeseCards();
  const index = g.richeseCache.findIndex((c) => c.effect === effect);
  assert.ok(index >= 0, effect);
  const card = g.richeseCache.splice(index, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(card);
  return card;
}
function ready(state: Game) {
  if (state.phase === 3)
    return normalizeAutomaticGame(savedMarket(structuredClone(state)));
  return state.players.reduce(
    (g, p) => applyAction(g, p.id, { type: 'ready' }),
    state,
  );
}
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const inventory = (g: Game) =>
  [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...(g.richeseCache ?? []),
    ...(g.auction?.cards ?? []),
  ]
    .map((c) => c.id)
    .sort();
function savedMarket(g: Game) {
  g.choamMarket = { owner: 'c', resume: 'phase', blocked: [] };
  g.decision = { kind: 'choamMarket', player: 'c' };
  return g;
}

void test('empty CHOAM closes the Bidding market and refunds allied escrow once using public hand counts', () => {
  for (const advanced of [false, true]) {
    const g = fixture(advanced);
    hold(g, 'e', 'Shield');
    hold(g, 'b', 'Snooper');
    g.aid = { c: { recipient: 'e', amount: 3 } };
    g.players[0].spice = 17;
    g.active = 'c';
    g.auction = {
      cards: [g.deck.shift()!],
      index: 0,
      bid: 0,
      bidder: null,
      active: 'c',
      passed: [],
      opener: 0,
    };
    const before = structuredClone(g),
      next = g.players.reduce(
        (state, p) => applyAction(state, p.id, { type: 'passBid' }),
        g,
      );
    assert.deepEqual(g, before);
    assert.equal(next.phase, 4);
    assert.equal(next.auction, null);
    assert.equal(next.choamMarket, null);
    assert.equal(next.players[0].spice, 20);
    assert.deepEqual(next.aid, {});
    assert.deepEqual(inventory(next), inventory(g));
    assert.deepEqual(normalizeAutomaticGame(reload(next)), reload(next));
    assert.throws(() =>
      applyAction(next, 'c', { type: 'decision', done: true }),
    );
  }
});

void test('empty storm and skipped battle markets keep manual completion outside Bidding', () => {
  let storm = fixture();
  storm.phase = 0;
  storm.stormPending = 0;
  storm = ready(storm);
  assert.equal(storm.phase, 0);
  assert.equal(storm.choamMarket?.resume, 'storm');
  assert.deepEqual(normalizeAutomaticGame(reload(storm)), reload(storm));
  storm = applyAction(storm, 'c', { type: 'decision', done: true });
  assert.equal(storm.phase, 1);
  assert.equal(storm.choamMarket, null);
  const movement = fixture();
  movement.phase = 5;
  movement.active = 'c';
  movement.movementRemaining = ['c'];
  let next = applyAction(movement, 'c', { type: 'endMovement' });
  assert.equal(next.phase, 5);
  assert.equal(next.decision?.kind, 'choamMarket');
  next = applyAction(next, 'c', { type: 'decision', done: true });
  assert.equal(next.phase, 6);
  assert.equal(next.decision?.kind, 'choamMarket');
  assert.deepEqual(normalizeAutomaticGame(reload(next)), reload(next));
  next = applyAction(next, 'c', { type: 'decision', done: true });
  assert.equal(next.phase, 7);
  assert.equal(next.choamMarket, null);
});

void test('all non-Bidding markets preserve identical opposing views across hidden owner and donor hand-count changes', () => {
  for (const phase of [0, 1, 2, 4, 5, 6, 7, 8])
    for (const changed of ['c', 'e']) {
      const a = savedMarket(fixture());
      a.phase = phase;
      if (phase === 0) a.choamMarket!.resume = 'storm';
      if (changed === 'e') hold(a, 'e', 'Shield');
      const b = structuredClone(a);
      hold(b, changed, 'Snooper');
      assert.deepEqual(viewGame(a, 'b'), viewGame(b, 'b'));
      const first = normalizeAutomaticGame(reload(a)),
        second = normalizeAutomaticGame(reload(b));
      assert.deepEqual(first, a);
      assert.deepEqual(second, b);
      assert.deepEqual(viewGame(first, 'b'), viewGame(second, 'b'));
      assert.equal(first.decision?.kind, 'choamMarket');
      assert.equal(first.phase, phase);
    }
});

void test('nonempty unsaleable and saleable hands both retain a private market; other two-card hands conservatively retain empty markets', () => {
  for (const name of ['Shield', 'Baliset']) {
    const g = fixture();
    hold(g, 'c', name);
    const next = ready(g);
    assert.equal(next.phase, 3);
    assert.equal(next.decision?.kind, 'choamMarket');
    assert.deepEqual(viewGame(next, 'e').choamMarket, { owner: 'c' });
    assert.equal(
      viewGame(next, 'e').players.find((p) => p.id === 'c')!.hand,
      undefined,
    );
  }
  for (const incoming of [false, true]) {
    const g = fixture();
    hold(g, 'e', 'Shield');
    if (incoming) cacheCard(g, 'e', 'distrans');
    else hold(g, 'e', 'Snooper');
    const next = ready(g);
    assert.equal(next.phase, 3);
    assert.equal(next.decision?.kind, 'choamMarket');
    assert.deepEqual(normalizeAutomaticGame(reload(next)), reload(next));
  }
});

void test('an empty market retains a legal incoming Distrans gift and its same-phase sale', () => {
  const g = fixture(),
    card = hold(g, 'e', 'Baliset'),
    distrans = cacheCard(g, 'e', 'distrans');
  let next = ready(g);
  next = applyAction(next, 'e', {
    type: 'card',
    card: distrans.id,
    target: 'c',
    give: card.id,
  });
  assert.equal(next.phase, 3);
  assert.equal(next.decision?.kind, 'choamMarket');
  assert.equal(viewGame(next, 'c').choamMarket?.sales?.[0].card, card.id);
  next = applyAction(reload(next), 'c', {
    type: 'decision',
    mode: 'sell',
    card: card.id,
  });
  assert.equal(next.phase, 4);
  assert.equal(next.players[0].spice, 22);
  assert.deepEqual(next.players[0].hand, []);
  assert.deepEqual(inventory(next), inventory(g));
});

void test('a reciprocal Richese ally with one card retains the gift opportunity without testing its hidden identity', () => {
  for (const richese of [false, true])
    for (const mutual of [false, true]) {
      const g = fixture();
      g.players[1].faction = richese ? 'richese' : 'emperor';
      if (richese) g.richeseCache = richeseCards();
      g.players[0].ally = 'e';
      if (mutual) g.players[1].ally = 'c';
      hold(g, 'e', 'Shield');
      const next = ready(g);
      assert.equal(next.phase, richese && mutual ? 3 : 4);
    }
  const g = fixture();
  g.players[1].faction = 'richese';
  g.players[0].ally = 'e';
  g.players[1].ally = 'c';
  const card = cacheCard(g, 'e', 'distrans');
  const next = applyAction(ready(g), 'e', {
    type: 'richeseGift',
    card: card.id,
  });
  assert.equal(next.phase, 3);
  assert.equal(next.decision?.kind, 'choamMarket');
  assert.deepEqual(next.players[0].hand, [card]);
  assert.equal(next.pendingRicheseGift, null);
});

void test('a nonempty unsaleable Box can prepare an end-phase sale and its paid search is never auto-closed', () => {
  const g = fixture(),
    box = cacheCard(g, 'c', 'nullentropyBox');
  const chosen = hold(g, 'e', 'Baliset'),
    other = hold(g, 'e', 'Shield');
  g.players[1].hand = [];
  g.discard = [chosen, other];
  let next = applyAction(ready(g), 'c', { type: 'card', card: box.id });
  assert.equal(next.decision?.kind, 'nullentropy');
  assert.deepEqual(normalizeAutomaticGame(reload(next)), reload(next));
  next = applyAction(next, 'c', {
    type: 'decision',
    event: next.pendingNullentropy!.event,
    card: chosen.id,
  });
  assert.equal(next.phase, 3);
  assert.equal(next.decision?.kind, 'choamMarket');
  next = applyAction(next, 'c', {
    type: 'decision',
    mode: 'sell',
    card: chosen.id,
  });
  assert.equal(next.phase, 4);
  assert.equal(next.players[0].spice, 20);
  assert.deepEqual(inventory(next), inventory(g));
});

void test('live sale, allied trade replies and Truthtrance take precedence over automatic completion', () => {
  const g = fixture(),
    card = hold(g, 'c', 'Baliset');
  const index = g.deck.findIndex((c) => c.effect === 'karama');
  g.players[1].hand.push(g.deck.splice(index, 1)[0]);
  const sale = applyAction(ready(g), 'c', {
    type: 'decision',
    mode: 'sell',
    card: card.id,
  });
  assert.equal(sale.response?.kind, 'choamSale');
  assert.deepEqual(normalizeAutomaticGame(reload(sale)), reload(sale));
  const traded = fixture();
  traded.players[0].ally = 'e';
  traded.players[1].ally = 'c';
  const offered = hold(traded, 'c', 'Shield');
  hold(traded, 'e', 'Snooper');
  const reply = applyAction(ready(traded), 'c', {
    type: 'decision',
    mode: 'trade',
    card: offered.id,
  });
  assert.equal(reply.decision?.kind, 'choamTradeReply');
  assert.deepEqual(normalizeAutomaticGame(reload(reply)), reload(reply));
  const empty = savedMarket(fixture()),
    truth = hold(empty, 'e', 'Truthtrance');
  const question = applyAction(empty, 'e', { type: 'card', card: truth.id });
  assert.ok(question.truthtrance);
  assert.equal(question.phase, 3);
  assert.deepEqual(normalizeAutomaticGame(reload(question)), reload(question));
});

void test('all four bot profiles sell the final Bidding-phase card and need no extra empty-market action', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    g.players[0].bot = difficulty;
    hold(g, 'c', 'Baliset');
    const market = ready(g),
      action = botActions(viewGame(market, 'c'))[0];
    assert.equal(action.mode, 'sell', difficulty);
    const next = applyAction(market, 'c', action);
    assert.equal(next.phase, 4, difficulty);
    assert.equal(next.choamMarket, null);
    assert.equal(next.players[0].spice, 22, difficulty);
  }
});
