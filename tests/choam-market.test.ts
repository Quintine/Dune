import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  RuleError,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { saleOptions } from '../game/choam-market';
import { createTechTokens } from '../game/tech-tokens';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
function fixture() {
  const g = createGame('MARKET22', newPlayer('c', 'CHOAM', 'choam'), false, [
    'choam',
  ]);
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'Bene Gesserit', 'beneGesserit'),
  );
  g.status = 'playing';
  g.phase = 2;
  g.choamCharity = { turn: 1, canceled: false };
  g.order = ['c', 'e', 'b'];
  g.deck = baseDeck();
  g.players.forEach((p) => {
    p.spice = 20;
    p.traitorChoices = [];
  });
  return g;
}
function ready(state: Game) {
  let g = state;
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
function allow(state: Game) {
  let g = state;
  while (g.response) {
    const p = g.players.find(
      (p) =>
        !viewGame(g, p.id).responseControls?.hasPassed &&
        !!viewGame(g, p.id).responseControls?.cancelCards.length,
    )!;
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  return g;
}
function hold(g: Game, id: string, name: string) {
  const i = g.deck.findIndex((c) => c.name === name);
  assert.ok(i >= 0, name);
  const card = g.deck.splice(i, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(card);
  return card;
}
function contest(g: Game, count = 1, id = 'e') {
  for (let n = 0; n < count; n++) {
    const index = g.deck.findIndex((card) => card.effect === 'karama');
    assert.ok(index >= 0);
    g.players.find((p) => p.id === id)!.hand.push(g.deck.splice(index, 1)[0]);
  }
  return g;
}
function cancel(g: Game) {
  const card = g.players
    .find((p) => p.id === 'e')!
    .hand.find((card) => card.effect === 'karama');
  assert.ok(card, 'canceller must hold Karama before the declaration');
  return applyAction(g, 'e', { type: 'card', card: card.id, mode: 'cancel' });
}
const done = (g: Game) => applyAction(g, 'c', { type: 'decision', done: true });
const sell = (g: Game, card: string, witness?: string) =>
  applyAction(g, 'c', { type: 'decision', mode: 'sell', card, witness });
function allied(g: Game) {
  g.players[0].ally = 'e';
  g.players[1].ally = 'c';
  return g;
}
function offer(g: Game, card: string) {
  return applyAction(g, 'c', { type: 'decision', mode: 'trade', card });
}
const live = (g: Game) =>
  [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...(g.auction?.cards.slice(g.auction.index) ?? []),
  ]
    .map((c) => c.id)
    .sort();
void test('outside Bidding the market preserves private empty and nonempty hand opportunities', () => {
  for (const cards of [false, true]) {
    const initial = fixture();
    if (cards) hold(initial, 'c', 'Baliset');
    let g = ready(initial);
    assert.equal(g.phase, 2);
    assert.equal(g.decision?.kind, 'choamMarket');
    assert.equal(g.auction, null);
    assert.deepEqual(viewGame(g, 'e').choamMarket, { owner: 'c' });
    assert.throws(
      () => applyAction(g, 'e', { type: 'decision', done: true }),
      /pending decision/,
    );
    assert.throws(
      () => applyAction(g, 'c', { type: 'charity' }),
      /pending decision/,
    );
    g = done(g);
    assert.equal(g.phase, 3);
    assert.ok(g.auction);
    assert.equal(g.choamMarket, null);
  }
});
void test('Worthless sale reveals its card but only discards and pays after the response', () => {
  const initial = contest(fixture());
  const card = hold(initial, 'c', 'Baliset');
  let g = sell(ready(initial), card.id);
  assert.equal(g.response?.kind, 'choamSale');
  assert.equal(g.players[0].hand.length, 1);
  assert.equal(g.players[0].spice, 20);
  g = allow(g);
  assert.equal(g.players[0].spice, 22);
  assert.equal(g.players[0].hand.length, 0);
  assert.equal(g.discard.at(-1)?.id, card.id);
  assert.equal(g.decision?.kind, 'choamMarket');
  assert.equal(g.phase, 2);
  assert.deepEqual(live(g), live(initial));
});
void test('surplus sales keep one exact duplicate and permit selling several surplus copies', () => {
  let g = fixture();
  const cards = [
    hold(g, 'c', 'Snooper'),
    hold(g, 'c', 'Snooper'),
    hold(g, 'c', 'Snooper'),
  ];
  const inventory = live(g);
  g = ready(g);
  g = allow(sell(g, cards[0].id, cards[2].id));
  g = allow(sell(g, cards[1].id, cards[2].id));
  assert.equal(g.players[0].spice, 26);
  assert.deepEqual(
    g.players[0].hand.map((c) => c.id),
    [cards[2].id],
  );
  assert.throws(() => sell(g, cards[2].id, cards[2].id), /exact duplicate/);
  assert.deepEqual(live(g), inventory);
});
void test('same-role cards do not count as identical duplicates and forged witnesses fail atomically', () => {
  let g = fixture();
  const snooper = hold(g, 'c', 'Snooper');
  const shield = hold(g, 'c', 'Shield');
  assert.equal(
    saleOptions([
      snooper,
      { ...shield, name: 'Shield Snooper', kind: 'shieldSnooper' },
    ]).length,
    0,
  );
  g = ready(g);
  const before = structuredClone(g);
  for (const witness of [shield.id, snooper.id, 'missing'])
    assert.throws(() => sell(g, snooper.id, witness), /exact duplicate/);
  assert.deepEqual(g, before);
});
void test('Karama preserves the sale card and price, prevents reselling that card this phase and allows other sales', () => {
  let g = fixture();
  const first = hold(g, 'c', 'Baliset');
  const second = hold(g, 'c', 'Kulon');
  g = cancel(sell(ready(contest(g)), first.id));
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[0].hand.length, 2);
  assert.throws(() => sell(g, first.id), /available/);
  g = allow(sell(g, second.id));
  assert.equal(g.players[0].spice, 22);
  assert.ok(g.players[0].hand.some((c) => c.id === first.id));
});
void test('an allied trade requires two chosen cards and CHOAM confirmation before either moves', () => {
  let g = allied(fixture());
  const a = hold(g, 'c', 'Shield');
  const b = hold(g, 'e', 'Snooper');
  const inventory = live(g);
  g = offer(ready(g), a.id);
  assert.equal(g.decision?.kind, 'choamTradeReply');
  assert.equal(viewGame(g, 'e').choamMarket?.offered?.id, a.id);
  assert.deepEqual(viewGame(g, 'b').choamMarket, { owner: 'c' });
  assert.throws(
    () => applyAction(g, 'e', { type: 'decision', card: a.id }),
    /your cards/,
  );
  g = applyAction(g, 'e', { type: 'decision', card: b.id });
  assert.equal(g.players[0].hand[0].id, a.id);
  assert.equal(g.players[1].hand[0].id, b.id);
  assert.equal(viewGame(g, 'c').choamMarket?.returned?.id, b.id);
  assert.equal(viewGame(g, 'b').choamMarket?.returned, undefined);
  g = applyAction(g, 'c', { type: 'decision', accept: true });
  assert.equal(g.players[0].hand[0].id, b.id);
  assert.equal(g.players[1].hand[0].id, a.id);
  assert.equal(g.choamTradeTurn, 1);
  assert.throws(() => offer(g, b.id), /once per turn/);
  assert.deepEqual(live(g), inventory);
});
void test('either ally may decline; no cards move and the once-per-turn exchange remains available', () => {
  for (const confirm of [false, true]) {
    let g = allied(fixture());
    const a = hold(g, 'c', 'Shield');
    const b = hold(g, 'e', 'Snooper');
    g = offer(ready(g), a.id);
    if (confirm) g = applyAction(g, 'e', { type: 'decision', card: b.id });
    g = applyAction(g, confirm ? 'c' : 'e', {
      type: 'decision',
      decline: true,
    });
    assert.equal(g.choamTradeTurn, undefined);
    assert.equal(g.players[0].hand[0].id, a.id);
    assert.equal(g.players[1].hand[0].id, b.id);
    assert.equal(g.decision?.kind, 'choamMarket');
  }
});
void test('an empty ally hand can decline and a player without an ally cannot offer a one-way gift', () => {
  let g = fixture();
  const a = hold(g, 'c', 'Shield');
  g = ready(g);
  assert.throws(() => offer(g, a.id), /need an ally/);
  g = offer(allied(g), a.id);
  assert.throws(
    () => applyAction(g, 'e', { type: 'decision', accept: true }),
    /cards/,
  );
  g = applyAction(g, 'e', { type: 'decision', decline: true });
  assert.equal(g.players[0].hand[0].id, a.id);
});
void test('trade confirmation checks current card custody and does not create or lose cards after an interruption', () => {
  let g = allied(fixture());
  const a = hold(g, 'c', 'Shield');
  const b = hold(g, 'e', 'Snooper');
  g = offer(ready(g), a.id);
  g = applyAction(g, 'e', { type: 'decision', card: b.id });
  // Represents a completed intervening card effect before confirmation.
  g.players[1].hand = [];
  g.discard.push(b);
  const inventory = live(g);
  g = applyAction(g, 'c', { type: 'decision', accept: true });
  assert.equal(g.players[0].hand[0].id, a.id);
  assert.equal(g.choamTradeTurn, undefined);
  assert.deepEqual(live(g), inventory);
});
void test('end-of-phase tech income settles once, after market completion', () => {
  let g = fixture();
  hold(g, 'c', 'Shield');
  g.techTokens = createTechTokens();
  g.techTokens.production.owner = 'c';
  g.techTokens.production.spice = 2;
  const card = hold(g, 'c', 'Baliset');
  g = allow(sell(ready(g), card.id));
  assert.equal(g.players[0].spice, 22);
  g = done(g);
  assert.equal(g.players[0].spice, 24);
  assert.equal(g.techTokens!.production.spice, 0);
});
void test('allied auction escrow is returned only once after the bidding closing window', () => {
  let g = fixture();
  hold(g, 'c', 'Shield');
  g.phase = 3;
  g.active = 'c';
  const card = g.deck.shift()!;
  g.auction = {
    cards: [card],
    index: 0,
    bid: 0,
    bidder: null,
    active: 'c',
    passed: [],
    opener: 0,
  };
  g.aid = { c: { recipient: 'e', amount: 3 } };
  g.players[0].spice = 17;
  for (const p of g.players) g = applyAction(g, p.id, { type: 'passBid' });
  assert.equal(g.players[0].spice, 17);
  g = done(g);
  assert.equal(g.players[0].spice, 20);
  assert.deepEqual(g.aid, {});
});
void test('storm closing resumes forecast and the next phase after the market, rather than skipping the window', () => {
  let g = fixture();
  hold(g, 'c', 'Baliset');
  g.phase = 0;
  g.stormPending = 0;
  g = ready(g);
  assert.equal(g.phase, 0);
  assert.equal(g.choamMarket?.resume, 'storm');
  g = done(g);
  assert.equal(g.phase, 1);
  assert.equal(g.choamMarket, null);
});
void test('automatically skipped battle phase still offers its own closing window', () => {
  let g = fixture();
  hold(g, 'c', 'Baliset');
  g.phase = 5;
  g.active = 'c';
  g.movementRemaining = ['c'];
  g = applyAction(g, 'c', { type: 'endMovement' });
  assert.equal(g.phase, 5);
  assert.equal(g.decision?.kind, 'choamMarket');
  g = done(g);
  assert.equal(g.phase, 6);
  assert.equal(g.decision?.kind, 'choamMarket');
  g = done(g);
  assert.equal(g.phase, 7);
});
void test('closing an empty auction opens the market before revival reset and next-phase Amal', () => {
  let g = fixture();
  hold(g, 'c', 'Baliset');
  g.phase = 3;
  g.active = 'c';
  const card = g.deck.shift()!;
  g.auction = {
    cards: [card],
    index: 0,
    bid: 0,
    bidder: null,
    active: 'c',
    passed: [],
    opener: 0,
  };
  g.players[0].revived = 2;
  g.expansions.push('ix');
  for (const p of g.players) g = applyAction(g, p.id, { type: 'passBid' });
  assert.equal(g.phase, 3);
  assert.equal(g.players[0].revived, 2);
  g = done(g);
  assert.equal(g.phase, 4);
  assert.ok(g.phaseOpening);
  assert.equal(g.players[0].revived, 2);
  g = ready(g);
  assert.equal(g.players[0].revived, 0);
});
void test('a pending sale survives JSON persistence and remains server-owned', () => {
  let g = contest(fixture());
  const card = hold(g, 'c', 'Baliset');
  g = sell(ready(g), card.id);
  g = JSON.parse(JSON.stringify(g)) as Game;
  assert.throws(() => done(g), RuleError);
  g = allow(g);
  assert.equal(g.players[0].spice, 22);
  g = done(g);
  assert.equal(g.phase, 3);
});
void test('all AI levels sell legally and complete empty or declined market choices', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = allied(fixture());
    hold(g, 'c', 'Baliset');
    hold(g, 'c', 'Shield');
    g.players.forEach((p) => {
      p.bot = difficulty;
    });
    g = ready(g);
    for (let i = 0; i < 20 && g.phase === 2; i++) {
      const id = g.response
        ? g.players.find(
            (p) =>
              !viewGame(g, p.id).responseControls?.hasPassed &&
              !!viewGame(g, p.id).responseControls?.cancelCards.length,
          )!.id
        : g.decision!.player;
      const actions = botActions(viewGame(g, id));
      assert.ok(actions.length, difficulty);
      g = applyAction(g, id, actions[0]);
    }
    assert.equal(g.phase, 3);
    assert.equal(g.players[0].spice, 22);
    assert.equal(g.players[0].hand[0].name, 'Shield');
  }
});

void test('Truthtrance can interrupt a pending sale without selling a card it consumed', () => {
  let g = contest(fixture());
  const first = hold(g, 'c', 'Truthtrance');
  const second = hold(g, 'c', 'Truthtrance');
  const inventory = live(g);
  g = sell(ready(g), first.id, second.id);
  g = applyAction(g, 'c', { type: 'card', card: first.id });
  while (g.truthtrance?.stage === 'priority') {
    const p = g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!;
    g = applyAction(g, p.id, { type: 'truthPass' });
  }
  g = applyAction(g, 'c', {
    type: 'truthAsk',
    question: {
      kind: 'fact',
      target: 'e',
      fact: { kind: 'hand', name: 'Shield' },
    },
  });
  g = applyAction(g, 'e', { type: 'truthAnswer', answer: 'no' });
  assert.equal(g.response?.kind, 'choamSale');
  g = allow(g);
  assert.equal(g.players[0].spice, 20);
  assert.deepEqual(
    g.players[0].hand.map((c) => c.id),
    [second.id],
  );
  assert.deepEqual(live(g), inventory);
  assert.equal(g.decision?.kind, 'choamMarket');
});

void test('the one-trade limit spans phase boundaries and renews when the turn advances', () => {
  let g = allied(fixture());
  const a = hold(g, 'c', 'Shield');
  const b = hold(g, 'e', 'Snooper');
  g = offer(ready(g), a.id);
  g = applyAction(g, 'e', { type: 'decision', card: b.id });
  g = applyAction(g, 'c', { type: 'decision', accept: true });
  g = done(g);
  g.phase = 4;
  g.auction = null;
  g.ready = [];
  g = ready(g);
  assert.throws(() => offer(g, b.id), /once per turn/);
  g.phase = 8;
  g = done(g);
  g = applyAction(g, 'c', { type: 'decision', done: true });
  assert.equal(g.turn, 2);
  g.phase = 4;
  g.ready = [];
  g.response = null;
  g = ready(g);
  g = offer(g, b.id);
  assert.equal(g.decision?.kind, 'choamTradeReply');
});
