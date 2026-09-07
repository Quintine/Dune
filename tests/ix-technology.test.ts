import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck, type Card } from '../game/cards';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
function fixture(advanced = false) {
  const g = createGame(
    'IXTECH22',
    newPlayer('i', 'Ixians', 'ixians'),
    advanced,
    ['ix'],
  );
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('a', 'Atreides', 'atreides'),
  );
  g.players.forEach((p) => {
    p.spice = 20;
    p.traitors = [p.leaders[0].id];
  });
  g.status = 'playing';
  g.phase = 2;
  g.order = g.players.map((p) => p.id);
  g.deck = baseDeck();
  return g;
}
function hold(g: Game, id: string, predicate: (c: Card) => boolean) {
  const index = g.deck.findIndex(predicate);
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(card);
  return card;
}
function ready(state: Game) {
  let g = state;
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
function auction(state = fixture()) {
  return ready(ready(state));
}
function allow(state: Game) {
  let g = state;
  while (g.response)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  return g;
}
function pool(state = fixture(), position: 'top' | 'bottom' = 'bottom') {
  const g = allow(auction(state));
  assert.equal(g.decision?.kind, 'ixAuction');
  return applyAction(g, 'i', {
    type: 'decision',
    card: g.ixAuction!.cards[0].id,
    position,
  });
}
function payment(buyer = 'a', advanced = false) {
  const g = fixture(advanced);
  g.phase = 3;
  if (buyer === 'h') g.players.push(newPlayer('h', 'Harkonnen', 'harkonnen'));
  const p = g.players.find((p) => p.id === buyer)!;
  p.spice = 20;
  p.ally = 'i';
  g.players[0].ally = buyer;
  g.order = g.players.map((p) => p.id);
  g.active = buyer;
  const won = g.deck.shift()!;
  g.auction = {
    cards: [won],
    index: 0,
    bid: 2,
    bidder: buyer,
    active: buyer,
    passed: [],
    opener: 0,
  };
  g.decision = { kind: 'auctionPayment', player: buyer };
  return g;
}
function liveCards(g: Game) {
  return [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();
}
void test('Ixian inspection has a public cancellation window before drawing or revealing any pool cards', () => {
  const initial = fixture();
  hold(initial, 'e', (c) => c.effect === 'karama');
  const deck = structuredClone(initial.deck);
  const g = auction(initial);
  assert.equal(g.response?.kind, 'ixAuction');
  assert.deepEqual(g.deck, deck);
  assert.equal(g.auction, null);
  assert.equal(viewGame(g, 'i').ixTechnology?.pool, null);
  assert.equal(viewGame(g, 'a').ixTechnology, null);
  assert.throws(
    () =>
      applyAction(g, 'i', {
        type: 'decision',
        card: deck[0].id,
        position: 'top',
      }),
    /response window/,
  );
});
void test('a full Ixian hand still permits inspection and the pool count uses only eligible bidders', () => {
  const initial = fixture();
  initial.players[0].hand = initial.deck.splice(0, 4);
  let g = allow(auction(initial));
  assert.equal(g.ixAuction!.cards.length, 3);
  g = applyAction(g, 'i', {
    type: 'decision',
    card: g.ixAuction!.cards[0].id,
    position: 'bottom',
  });
  assert.equal(g.auction!.cards.length, 2);
  assert.equal(g.auction!.active, 'e');
});
void test('Karama cancellation draws only the ordinary pool and does not expose it to Ixians', () => {
  const initial = fixture();
  const karama = hold(initial, 'e', (c) => c.effect === 'karama');
  const expected = initial.deck.slice(0, 3);
  let g = auction(initial);
  g = applyAction(g, 'e', { type: 'card', mode: 'cancel', card: karama.id });
  assert.deepEqual(g.auction!.cards, expected);
  assert.equal(g.deck.length, initial.deck.length - 3);
  assert.equal(g.ixAuction, null);
  assert.deepEqual(viewGame(g, 'i').ixTechnology?.known, []);
  assert.equal(g.response, null);
  assert.equal(viewGame(g, 'a').auction?.card?.id, expected[0].id);
  g = allow(g);
  assert.equal(viewGame(g, 'a').auction?.card?.id, expected[0].id);
});
void test('top and bottom choices preserve the rest of the deck and conceal both choice and shuffled order', () => {
  for (const position of ['top', 'bottom'] as const) {
    let g = allow(auction());
    const cards = [...g.ixAuction!.cards],
      rest = [...g.deck],
      selected = cards[1];
    assert.equal(viewGame(g, 'a').ixTechnology, null);
    g = applyAction(JSON.parse(JSON.stringify(g)), 'i', {
      type: 'decision',
      card: selected.id,
      position,
    });
    assert.deepEqual(
      g.deck,
      position === 'top' ? [selected, ...rest] : [...rest, selected],
    );
    assert.deepEqual(
      g.auction!.cards.map((c) => c.id).sort(),
      cards
        .filter((c) => c.id !== selected.id)
        .map((c) => c.id)
        .sort(),
    );
    const own = viewGame(g, 'i');
    assert.equal(own.auction?.card, null);
    assert.deepEqual(
      own.ixTechnology?.known.map((c) => c.id),
      cards
        .filter((c) => c.id !== selected.id)
        .map((c) => c.id)
        .sort(),
    );
    const outsider = JSON.stringify(viewGame(g, 'e'));
    for (const card of cards) assert.equal(outsider.includes(card.id), false);
    assert.equal(g.log.at(-1)!.text.includes(position), true);
    assert.equal(g.log.at(-1)!.text.includes(selected.name), false);
  }
});
void test('invalid or unauthorized pool choices cannot mutate the state', () => {
  const g = allow(auction()),
    before = structuredClone(g);
  for (const [id, card, position] of [
    ['e', g.ixAuction!.cards[0].id, 'top'],
    ['i', 'not-in-pool', 'top'],
    ['i', g.ixAuction!.cards[0].id, 'middle'],
  ]) {
    assert.throws(() =>
      applyAction(g, id, { type: 'decision', card, position }),
    );
    assert.deepEqual(g, before);
  }
});
void test('advanced substitution occurs before Atreides inspection and exchanges exactly one private hand card', () => {
  const initial = fixture(true);
  hold(initial, 'e', (c) => c.effect === 'karama');
  const offered = hold(initial, 'i', (c) => c.kind === 'worthless');
  let g = pool(initial);
  const incoming = g.auction!.cards[0];
  assert.equal(g.decision?.kind, 'ixTechnology');
  assert.equal(g.response, null);
  assert.equal(viewGame(g, 'a').auction?.card, null);
  g = applyAction(g, 'i', { type: 'decision', card: offered.id });
  assert.equal(g.response?.kind, 'ixTechnology');
  assert.equal(g.auction!.cards[0].id, incoming.id);
  assert.equal(JSON.stringify(viewGame(g, 'e')).includes(offered.id), false);
  g = allow(JSON.parse(JSON.stringify(g)));
  assert.equal(g.players[0].hand.length, 1);
  assert.equal(g.players[0].hand[0].id, incoming.id);
  assert.equal(g.auction!.cards[0].id, offered.id);
  assert.equal(viewGame(g, 'a').auction?.card?.id, offered.id);
  assert.equal(viewGame(g, 'i').ixTechnology?.used, true);
  assert.equal(viewGame(g, 'i').auction?.card, null);
});
void test('canceling substitution preserves both cards and consumes the once-per-round attempt without leaking its result', () => {
  const initial = fixture(true);
  const offered = hold(initial, 'i', (c) => c.kind === 'worthless');
  const cancel = hold(initial, 'e', (c) => c.effect === 'karama');
  let g = pool(initial);
  const incoming = g.auction!.cards[0];
  g = applyAction(g, 'i', { type: 'decision', card: offered.id });
  g = applyAction(g, 'e', { type: 'card', mode: 'cancel', card: cancel.id });
  assert.equal(g.players[0].hand[0].id, offered.id);
  assert.equal(g.auction!.cards[0].id, incoming.id);
  assert.equal(g.ixTechnologyTurn, g.turn);
  assert.equal(g.pendingIxTechnology, null);
  assert.equal(g.response, null);
  assert.equal(viewGame(g, 'a').auction?.card?.id, incoming.id);
});
void test('declining substitution saves it for the next card, while using it removes later offers', () => {
  for (const use of [false, true]) {
    const initial = fixture(true);
    const offered = hold(initial, 'i', (c) => c.kind === 'worthless');
    let g = pool(initial);
    g = allow(
      applyAction(
        g,
        'i',
        use
          ? { type: 'decision', card: offered.id }
          : { type: 'decision', decline: true },
      ),
    );
    g = applyAction(g, 'i', { type: 'bid', amount: 1 });
    while (g.auction?.index === 0)
      g = applyAction(g, g.auction!.active, { type: 'passBid' });
    assert.notEqual(g.decision?.kind, 'auctionPayment');
    assert.equal(g.players[0].spice, 19);
    g = allow(g);
    assert.equal(g.auction!.index, 1);
    assert.equal(g.decision?.kind, use ? undefined : 'ixTechnology');
  }
});
void test('starting-card choice deals the shuffled remainder privately and gives Harkonnen an extra deck card', () => {
  let g = fixture();
  g.players.push(newPlayer('h', 'Harkonnen', 'harkonnen'));
  g.players[3].traitors = [g.players[3].leaders[0].id];
  g.status = 'setup';
  g.ixSetupCards = g.deck.splice(0, 4);
  g.decision = { kind: 'ixSetup', player: 'i' };
  const selected = g.ixSetupCards[2],
    remainder = g.ixSetupCards.filter((c) => c.id !== selected.id),
    bonus = g.deck[0];
  assert.deepEqual(viewGame(g, 'i').ixTechnology?.setup, g.ixSetupCards);
  const other = JSON.stringify(viewGame(g, 'e'));
  for (const c of g.ixSetupCards) assert.equal(other.includes(c.id), false);
  assert.throws(() =>
    applyAction(g, 'e', { type: 'decision', card: selected.id }),
  );
  g = applyAction(JSON.parse(JSON.stringify(g)), 'i', {
    type: 'decision',
    card: selected.id,
  });
  assert.equal(g.players[0].hand[0].id, selected.id);
  assert.deepEqual(
    g.players
      .slice(1)
      .flatMap((p) => p.hand)
      .filter((c) => c.id !== bonus.id)
      .map((c) => c.id)
      .sort(),
    remainder.map((c) => c.id).sort(),
  );
  assert.equal(g.players[3].hand.length, 2);
  assert.ok(g.players[3].hand.some((c) => c.id === bonus.id));
  assert.equal(g.ixSetupCards, null);
  assert.equal(g.status, 'playing');
  assert.ok(g.phaseOpening);
  assert.deepEqual(
    liveCards(g),
    baseDeck()
      .map((c) => c.id)
      .sort(),
  );
});
void test('an Ixian ally decides only on its purchased card, after paying and before Emperor income', () => {
  let g = payment();
  const won = g.auction!.cards[0];
  const old = hold(g, 'a', (c) => c.kind === 'snooper');
  const replacement = g.deck[0];
  g = applyAction(g, 'a', { type: 'decision', karama: false });
  assert.equal(g.players[2].spice, 18);
  assert.equal(g.players[1].spice, 20);
  assert.equal(g.decision?.kind, 'ixAllyCard');
  assert.equal(viewGame(g, 'a').ixPurchased?.id, won.id);
  assert.equal(viewGame(g, 'i').ixPurchased, null);
  g = applyAction(g, 'a', { type: 'decision', accept: true });
  assert.equal(g.response, null);
  g = allow(g);
  assert.ok(g.players[2].hand.some((c) => c.id === replacement.id));
  assert.ok(g.players[2].hand.some((c) => c.id === old.id));
  assert.ok(g.discard.some((c) => c.id === won.id));
  assert.equal(g.players[1].spice, 22);
  assert.equal(g.pendingIxAlly, null);
  assert.deepEqual(
    liveCards(g),
    baseDeck()
      .map((c) => c.id)
      .sort(),
  );
});
void test('keeping or canceling an allied replacement retains the purchase and still settles payment once', () => {
  for (const mode of ['keep', 'cancel'] as const) {
    let g = payment();
    const won = g.auction!.cards[0];
    const card = hold(g, 'e', (c) => c.effect === 'karama');
    g = applyAction(g, 'a', { type: 'decision', karama: false });
    g = applyAction(g, 'a', { type: 'decision', accept: mode === 'cancel' });
    if (mode === 'cancel')
      g = applyAction(g, 'e', { type: 'card', mode: 'cancel', card: card.id });
    g = allow(g);
    assert.ok(g.players[2].hand.some((c) => c.id === won.id));
    assert.equal(g.players[1].spice, 22);
    assert.equal(g.players[2].spice, 18);
  }
});
void test('Harkonnen ally replaces the purchased card before receiving its separate bonus', () => {
  let g = payment('h');
  const replacement = g.deck[0],
    bonus = g.deck[1],
    won = g.auction!.cards[0];
  g = applyAction(g, 'h', { type: 'decision', karama: false });
  g = applyAction(g, 'h', { type: 'decision', accept: true });
  g = allow(g);
  assert.deepEqual(
    g.players[3].hand.map((c) => c.id),
    [replacement.id, bonus.id],
  );
  assert.ok(g.discard.some((c) => c.id === won.id));
  assert.equal(g.pendingIxAlly, null);
  assert.equal(g.decision, null);
  assert.deepEqual(
    liveCards(g),
    baseDeck()
      .map((c) => c.id)
      .sort(),
  );
});
void test('a Karama-paid purchase can be replaced but generates no Emperor income', () => {
  let g = payment();
  const card = hold(g, 'a', (c) => c.effect === 'karama');
  g = applyAction(g, 'a', { type: 'decision', karama: true, card: card.id });
  assert.equal(g.decision?.kind, 'ixAllyCard');
  g = allow(applyAction(g, 'a', { type: 'decision', accept: true }));
  assert.equal(g.players[2].spice, 20);
  assert.equal(g.players[1].spice, 20);
  assert.deepEqual(
    liveCards(g),
    baseDeck()
      .map((c) => c.id)
      .sort(),
  );
});
void test('Bene Gesserit conversion cancellation restores the private Ixian substitution window', () => {
  const initial = fixture(true);
  initial.players[1].faction = 'beneGesserit';
  const offered = hold(initial, 'i', (c) => c.kind === 'worthless');
  const worthless = hold(initial, 'e', (c) => c.kind === 'worthless');
  const karama = hold(initial, 'a', (c) => c.effect === 'karama');
  let g = pool(initial);
  g = applyAction(g, 'i', { type: 'decision', card: offered.id });
  g = applyAction(g, 'e', { type: 'card', mode: 'cancel', card: worthless.id });
  assert.equal(g.response?.kind, 'worthlessKarama');
  assert.equal(JSON.stringify(viewGame(g, 'a')).includes(offered.id), false);
  const incoming = g.auction!.cards[0];
  g = applyAction(g, 'a', { type: 'card', mode: 'cancel', card: karama.id });
  assert.equal(g.response, null);
  assert.equal(g.pendingIxTechnology, null);
  g = allow(g);
  assert.ok(g.players[0].hand.some((c) => c.id === incoming.id));
});
void test('exhausted or one-card decks cannot leave an impossible pool-selection decision', () => {
  for (const n of [0, 1]) {
    const initial = fixture();
    initial.deck = initial.deck.slice(0, n);
    const g = allow(auction(initial));
    assert.equal(g.ixAuction, null);
    assert.equal(g.decision, null);
    assert.equal(g.auction?.cards.length ?? 0, n);
  }
});
void test('all AI levels handle starting selection and a complete advanced Ixian bidding phase', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = fixture(true);
    g.players.forEach((p) => {
      p.bot = difficulty;
    });
    hold(g, 'i', (c) => c.kind === 'worthless');
    g.players[0].ally = 'a';
    g.players[2].ally = 'i';
    g = auction(g);
    for (let i = 0; g.phase === 3 && i < 300; i++) g = runBots(g, 1);
    assert.equal(g.phase, 4, difficulty);
    assert.deepEqual(
      liveCards(g),
      baseDeck()
        .map((c) => c.id)
        .sort(),
    );
    g = fixture();
    g.status = 'setup';
    g.players[0].bot = difficulty;
    g.ixSetupCards = g.deck.splice(0, 3);
    g.decision = { kind: 'ixSetup', player: 'i' };
    const choice = botActions(viewGame(g, 'i'))[0];
    assert.ok(choice);
    g = applyAction(g, 'i', choice);
    assert.equal(g.players[0].hand.length, 1);
  }
});
void test('no eligible bidder skips inspection; empty Ixian hands skip only the advanced swap offer', () => {
  const initial = fixture();
  for (const p of initial.players) p.hand = initial.deck.splice(0, 4);
  let g = auction(initial);
  assert.equal(g.phase, 4);
  assert.equal(g.ixAuction, undefined);
  assert.equal(g.response, null);
  g = pool(fixture(true));
  assert.equal(g.decision, null);
  assert.equal(g.response, null);
  assert.ok(viewGame(g, 'a').auction?.card);
});
void test('canceling auction inspection does not also cancel advanced substitution', () => {
  const initial = fixture(true);
  const offered = hold(initial, 'i', (c) => c.kind === 'worthless'),
    karama = hold(initial, 'e', (c) => c.effect === 'karama');
  let g = auction(initial);
  g = applyAction(g, 'e', { type: 'card', mode: 'cancel', card: karama.id });
  assert.equal(g.decision?.kind, 'ixTechnology');
  assert.deepEqual(viewGame(g, 'i').ixTechnology?.known, []);
  const incoming = g.auction!.cards[0];
  g = allow(applyAction(g, 'i', { type: 'decision', card: offered.id }));
  assert.equal(g.players[0].hand[0].id, incoming.id);
  assert.equal(viewGame(g, 'a').auction?.card?.id, offered.id);
});
void test('a Harkonnen exchange cannot strand a substitution whose offered card changed hands', () => {
  const initial = fixture(true);
  initial.players.push(newPlayer('h', 'Harkonnen', 'harkonnen'));
  initial.order.push('h');
  const offered = hold(initial, 'i', (c) => c.kind === 'worthless'),
    karama = hold(initial, 'h', (c) => c.effect === 'karama'),
    returned = hold(initial, 'h', (c) => c.kind === 'hero');
  let g = pool(initial);
  const incoming = g.auction!.cards[0];
  g = applyAction(g, 'i', { type: 'decision', card: offered.id });
  g = applyAction(g, 'h', {
    type: 'card',
    mode: 'special',
    card: karama.id,
    target: 'i',
    amount: 1,
  });
  assert.equal(g.decision?.kind, 'handExchange');
  g = applyAction(g, 'h', { type: 'decision', returnCards: [returned.id] });
  assert.equal(g.response, null);
  g = allow(g);
  assert.equal(g.auction!.cards[0].id, incoming.id);
  assert.equal(g.players[0].hand[0].id, returned.id);
  assert.equal(g.pendingIxTechnology, null);
  assert.equal(g.ixTechnologyTurn, g.turn);
});
void test('a purchased card removed by hand exchange cannot be replaced through a stale ally decision', () => {
  let g = payment('a', true);
  g.players.push(newPlayer('h', 'Harkonnen', 'harkonnen'));
  g.order.push('h');
  const won = g.auction!.cards[0],
    karama = hold(g, 'h', (c) => c.effect === 'karama'),
    returned = hold(g, 'h', (c) => c.kind === 'hero');
  g = applyAction(g, 'a', { type: 'decision', karama: false });
  g = applyAction(g, 'h', {
    type: 'card',
    mode: 'special',
    card: karama.id,
    target: 'a',
    amount: 1,
  });
  g = applyAction(g, 'h', { type: 'decision', returnCards: [returned.id] });
  assert.equal(g.decision?.kind, 'ixAllyCard');
  assert.equal(viewGame(g, 'a').ixPurchased, null);
  assert.throws(
    () => applyAction(g, 'a', { type: 'decision', accept: true }),
    /must remain available/,
  );
  g = allow(applyAction(g, 'a', { type: 'decision', accept: false }));
  assert.ok(g.players[3].hand.some((c) => c.id === won.id));
  assert.equal(g.players[1].spice, 22);
  assert.equal(g.pendingIxAlly, null);
});
void test('a returned card already in the inspected pool does not duplicate private knowledge entries', () => {
  let g = pool(fixture(true)); // Empty Ixian hand bypasses the initial swap choice.
  g = allow(g);
  const previous = g.auction!.cards[0];
  g = applyAction(g, 'i', { type: 'bid', amount: 1 });
  while (g.auction?.index === 0)
    g = applyAction(g, g.auction!.active, { type: 'passBid' });
  assert.notEqual(g.decision?.kind, 'auctionPayment');
  assert.equal(g.players[0].spice, 19);
  g = allow(g);
  assert.equal(g.decision?.kind, 'ixTechnology');
  g = allow(applyAction(g, 'i', { type: 'decision', card: previous.id }));
  const known = viewGame(g, 'i').ixTechnology!.known;
  assert.equal(new Set(known.map((c) => c.id)).size, known.length);
});
