import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  newPlayer,
  joinGame,
  applyAction,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';
const deck = baseDeck();
const karmas = deck.filter((c) => c.effect === 'karama');
const otherCards = deck.filter((c) => c.effect !== 'karama');
function fixture() {
  let g = createGame('SPECIAL2', newPlayer('h', 'Harkonnen', 'harkonnen'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('g', 'Guild', 'guild'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'h', { type: 'start' });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  g.advanced = true;
  g.phase = 3;
  g.active = 'e';
  g.order = ['h', 'e', 'g'];
  g.players[0].hand = [karmas[0], ...otherCards.slice(0, 7)];
  g.players[1].hand = [karmas[1]];
  g.players[2].hand = otherCards.slice(7, 11);
  g.deck = [];
  g.discard = [];
  g.auction = {
    cards: [otherCards[12]],
    index: 0,
    bid: 2,
    bidder: 'g',
    active: 'e',
    passed: [],
    opener: 1,
  };
  return g;
}
function exchange(g: Game, amount = 4) {
  return applyAction(g, 'h', {
    type: 'card',
    mode: 'special',
    card: karmas[0].id,
    target: 'g',
    amount,
  });
}
function returned(
  g: Game,
  cards = g.players[0].hand
    .slice(0, g.decision?.kind === 'handExchange' ? g.decision.count : 0)
    .map((c) => c.id),
) {
  return applyAction(g, 'h', { type: 'decision', returnCards: cards });
}
function stock(state: Game) {
  const g = structuredClone(state);
  g.phase = 4;
  g.auction = null;
  g.players[1].tanks = 5;
  g.players[1].reserves = 15;
  g.players[1].elites = { tanks: 2, reserves: 3, forces: {}, revived: 0 };
  return g;
}
function revive(
  g: Game,
  extra: Record<string, unknown> = { amount: 3, elite: 1 },
) {
  return applyAction(g, 'e', {
    type: 'card',
    mode: 'special',
    card: karmas[1].id,
    ...extra,
  });
}
function allCards(g: Game) {
  return [
    ...g.players.flatMap((p) => p.hand),
    ...g.deck,
    ...g.discard,
    ...(g.auction?.cards ?? []),
  ]
    .map((c) => c.id)
    .sort();
}
void test('Harkonnen draws unseen cards beyond the temporary hand limit and returns equal cards from the combined hand', () => {
  const before = fixture();
  const identities = allCards(before);
  let g = exchange(before);
  assert.equal(before.players[0].hand.length, 8);
  assert.equal(g.players[0].hand.length, 11);
  assert.equal(g.players[2].hand.length, 0);
  assert.equal(g.response, null);
  assert.equal(g.players[0].specialKaramaUsed, true);
  assert.deepEqual(allCards(g), identities);
  const mixed = [otherCards[0].id, ...otherCards.slice(7, 10).map((c) => c.id)];
  g = returned(g, mixed);
  assert.equal(g.players[0].hand.length, 7);
  assert.deepEqual(new Set(g.players[2].hand.map((c) => c.id)), new Set(mixed));
  assert.equal(g.players[2].hand.length, 4);
  assert.equal(g.pendingExchange, null);
  assert.deepEqual(allCards(g), identities);
  assert.deepEqual(g.auction, before.auction);
  assert.equal(g.active, before.active);
});
void test('the exchange exposes card identities only through each owner’s private hand and hides suspended private responses', () => {
  const before = fixture();
  // Keep an actual eligible responder after the special Karama is spent.
  const swapped = before.players[0].hand[7];
  before.players[0].hand[7] = karmas[1];
  before.players[1].hand = [swapped];
  before.response = {
    kind: 'emperorGift',
    owner: 'e',
    recipient: 'g',
    amount: 7,
    passed: ['g'],
  };
  const g = exchange(before);
  const publicView = viewGame(JSON.parse(JSON.stringify(g)), 'e');
  assert.equal(publicView.players[0].hand, undefined);
  assert.equal(publicView.players[2].hand, undefined);
  assert.equal('pendingExchange' in publicView, false);
  assert.equal(publicView.response, null);
  assert.deepEqual(publicView.decision, {
    kind: 'handExchange',
    player: 'h',
    target: 'g',
    count: 4,
  });
  assert.equal(viewGame(g, 'h').players[0].hand!.length, 11);
  assert.ok(
    g.log.every(
      (l) => !otherCards.slice(7, 11).some((c) => l.text.includes(c.name)),
    ),
  );
  const result = returned(g);
  assert.deepEqual(result.response, before.response);
  assert.equal(viewGame(result, 'h').response!.amount, undefined);
});
void test('invalid exchange amounts, explicit card selection, wrong phases and self targeting are atomic', () => {
  const g = fixture();
  const action = {
    type: 'card',
    mode: 'special',
    card: karmas[0].id,
    target: 'g',
    amount: 4,
  };
  for (const extra of [
    { amount: 0 },
    { amount: 5 },
    { amount: 1.5 },
    { cards: [otherCards[7].id] },
    { target: 'h' },
  ]) {
    assert.throws(() => applyAction(g, 'h', { ...action, ...extra }));
    assert.equal(g.players[0].hand.length, 8);
    assert.equal(g.players[0].specialKaramaUsed, undefined);
  }
  g.phase = 5;
  assert.throws(() => applyAction(g, 'h', action), /during Bidding/);
  g.phase = 3;
  g.advanced = false;
  assert.throws(() => applyAction(g, 'h', action), /advanced game/);
});
void test('only Harkonnen can finish the exchange and must return exactly distinct cards it currently holds', () => {
  const g = exchange(fixture());
  const before = structuredClone(g);
  assert.throws(
    () => applyAction(g, 'g', { type: 'decision', returnCards: [] }),
    /pending decision/,
  );
  assert.throws(() => returned(g, [otherCards[0].id]), /exactly/);
  assert.throws(() => returned(g, Array(4).fill(otherCards[0].id)), /exactly/);
  assert.throws(
    () =>
      returned(g, [
        'missing',
        ...g.players[0].hand.slice(0, 3).map((c) => c.id),
      ]),
    /exactly/,
  );
  assert.throws(
    () =>
      applyAction(g, 'e', { type: 'card', mode: 'cancel', card: karmas[1].id }),
    /pending decision/,
  );
  assert.throws(
    () => applyAction(g, 'e', { type: 'bid', amount: 10 }),
    /pending decision/,
  );
  assert.deepEqual(g, before);
});
void test('partial blind draws leave the rest of the target hand untouched and cannot exceed its size', () => {
  const before = fixture();
  const g = exchange(before, 2);
  assert.equal(g.players[2].hand.length, 2);
  assert.ok(
    g.players[2].hand.every((c) =>
      before.players[2].hand.some((original) => c.id === original.id),
    ),
  );
  assert.equal(
    g.players[0].hand.filter((c) =>
      before.players[2].hand.some((original) => c.id === original.id),
    ).length,
    2,
  );
  const one = fixture();
  one.players[2].hand = [otherCards[7]];
  assert.throws(() => exchange(one, 2), /Cards to take/);
});
void test('exchange resumes a pending winning payment, using provisional recovery only when taking its last funding Karama', () => {
  const before = fixture();
  before.players[2].hand = [karmas[1]];
  before.players[1].hand = [];
  before.players[2].spice = 1;
  before.auction!.bid = 30;
  before.auction!.bidder = 'g';
  before.decision = { kind: 'auctionPayment', player: 'g' };
  const pending = exchange(before, 1);
  const restored = returned(pending, [karmas[1].id]);
  assert.deepEqual(restored.decision, before.decision);
  assert.equal(restored.auction!.bid, 30);
  const unfunded = returned(pending, [otherCards[0].id]);
  assert.equal(unfunded.auction!.bid, 0);
  assert.equal(unfunded.decision, null);
  assert.equal(unfunded.auction!.cards[0].id, otherCards[12].id);
  assert.equal(unfunded.players[2].spice, 1);
});
void test('special power usage persists across turns and does not disable ordinary Karama use', () => {
  let g = returned(exchange(fixture()));
  g.players[0].hand.push(karmas[1]);
  g.turn = 2;
  assert.throws(
    () =>
      applyAction(g, 'h', {
        type: 'card',
        mode: 'special',
        card: karmas[1].id,
        target: 'g',
        amount: 1,
      }),
    /already been used/,
  );
  assert.equal(viewGame(g, 'e').players[0].specialKaramaUsed, true);
  g.phase = 5;
  g.active = 'h';
  g = applyAction(g, 'h', {
    type: 'card',
    mode: 'shipment',
    card: karmas[1].id,
  });
  assert.deepEqual(g.karamaShipping, {
    player: 'h',
    owner: 'h',
    card: karmas[1].id,
  });
});
void test('Emperor special revival is free, separate from normal quota and preserves the one-elite-per-turn limit', () => {
  const before = stock(fixture());
  before.players[1].revived = 3;
  const spice = before.players[1].spice;
  const g = revive(before);
  assert.equal(g.players[1].tanks, 2);
  assert.equal(g.players[1].reserves, 18);
  assert.equal(g.players[1].elites!.tanks, 1);
  assert.equal(g.players[1].elites!.reserves, 4);
  assert.equal(g.players[1].elites!.revived, 1);
  assert.equal(g.players[1].revived, 3);
  assert.equal(g.players[1].spice, spice);
  assert.equal(g.response, null);
  const already = stock(fixture());
  already.players[1].elites!.revived = 1;
  assert.throws(() => revive(already), /one elite/);
  assert.equal(already.players[1].specialKaramaUsed, undefined);
  assert.equal(
    revive(already, { amount: 3, elite: 0 }).players[1].elites!.revived,
    1,
  );
});
void test('Emperor revives a leader outside the normal cycle without consuming the normal leader allowance', () => {
  const g = stock(fixture());
  const leader = g.players[1].leaders[0];
  leader.dead = true;
  leader.deaths = 2;
  leader.concealed = { captor: 'h', dead: false, deaths: 0 };
  g.players[1].leaderRevived = true;
  const result = revive(g, { leader: leader.id });
  assert.equal(result.players[1].leaders[0].dead, false);
  assert.equal(result.players[1].leaders[0].deaths, 2);
  assert.equal(result.players[1].leaders[0].concealed, undefined);
  assert.equal(result.players[1].leaderRevived, true);
  assert.equal(result.players[1].revivalCycle, 0);
  assert.throws(() => revive(g, { leader: leader.id, amount: 2 }), /not both/);
  assert.throws(
    () => revive(g, { leader: 'harkonnen-0' }),
    /your dead leaders/,
  );
});
void test('Emperor invalid special revivals preserve the card and usage and cannot revive an ally’s forces', () => {
  const g = stock(fixture());
  for (const extra of [
    { amount: 4 },
    { amount: 0 },
    { amount: 2, elite: 2 },
    { amount: 1, target: 'g' },
  ]) {
    assert.throws(() => revive(g, extra));
    assert.equal(g.players[1].hand[0].id, karmas[1].id);
    assert.equal(g.players[1].specialKaramaUsed, undefined);
  }
  g.phase = 5;
  assert.throws(() => revive(g), /during Revival/);
});
void test('AI initiates and completes hand exchange using public hand counts and its own acquired cards', () => {
  let g = fixture();
  g.players[0].bot = 'Hard';
  const action = botActions(viewGame(g, 'h'))[0];
  assert.equal(action.mode, 'special');
  assert.equal(action.target, 'g');
  g = applyAction(g, 'h', action);
  const returnAction = botActions(viewGame(g, 'h'))[0];
  assert.equal(returnAction.returnCards instanceof Array, true);
  assert.equal((returnAction.returnCards as string[]).length, 4);
  g = applyAction(g, 'h', returnAction);
  assert.equal(g.decision, null);
  assert.equal(g.players[0].hand.length, 7);
});
void test('Emperor AI can spend its special revival once and then continue ordinary revival', () => {
  let g = stock(fixture());
  g.players[1].bot = 'Hard';
  const first = botActions(viewGame(g, 'e'))[0];
  assert.equal(first.mode, 'special');
  g = applyAction(g, 'e', first);
  assert.ok(botActions(viewGame(g, 'e')).every((a) => a.mode !== 'special'));
  assert.ok(botActions(viewGame(g, 'e')).some((a) => a.type === 'revive'));
});
